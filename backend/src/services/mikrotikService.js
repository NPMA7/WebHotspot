/**
 * mikrotikService.js
 * Abstraksi komunikasi dengan Mikrotik RouterOS via API (port 8728)
 * Menggunakan library: node-routeros
 */

const { RouterOSAPI } = require("node-routeros");

// Programmatic patch for Channel prototype to handle !empty gracefully (avoiding UNKNOWNREPLY crash)
try {
  const { Channel } = require("node-routeros/dist/Channel");
  if (Channel && Channel.prototype && Channel.prototype.processPacket) {
    const originalProcessPacket = Channel.prototype.processPacket;
    Channel.prototype.processPacket = function (packet) {
      if (packet && packet[0] === "!empty") {
        packet[0] = "!done";
      }
      return originalProcessPacket.call(this, packet);
    };
  }
} catch (err) {
  console.error("Failed to apply Channel prototype patch:", err.message);
}

// Programmatic patch for Receiver prototype to handle unregistered tags gracefully (avoiding UNREGISTEREDTAG crash)
try {
  const { Receiver } = require("node-routeros/dist/connector/Receiver");
  if (Receiver && Receiver.prototype && Receiver.prototype.sendTagData) {
    const originalSendTagData = Receiver.prototype.sendTagData;
    Receiver.prototype.sendTagData = function (currentTag) {
      if (!this.tags || !this.tags.has(currentTag)) {
        // Swallow error silently instead of throwing and crashing the process
        return;
      }
      return originalSendTagData.call(this, currentTag);
    };
  }
} catch (err) {
  console.error("Failed to apply Receiver prototype patch:", err.message);
}

// ─── Connection Manager ──────────────────────────────────────────────────────

/**
 * Mempatch conn.write untuk menyertakan timeout 5 detik dan penanganan error !empty.
 * Tanpa timeout ini, jika koneksi TCP setengah terbuka (half-open/dead), perintah write
 * akan menggantung selamanya karena node-routeros tidak membatasi waktu tunggu respon write.
 */
const patchWriteWithTimeout = (conn) => {
  const originalWrite = conn.write.bind(conn);
  conn.write = async (...args) => {
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        timer = null;
        reject(new Error("Mikrotik API Write Timeout (5s)"));
      }, 5000);

      originalWrite(...args)
        .then((result) => {
          if (timer) {
            clearTimeout(timer);
            resolve(result || []);
          }
        })
        .catch((err) => {
          if (timer) {
            clearTimeout(timer);
            if (
              err.errno === "UNKNOWNREPLY" ||
              (err.message && err.message.includes("!empty"))
            ) {
              resolve([]);
            } else {
              reject(err);
            }
          }
        });
    });
  };
};

/**
 * Membuat koneksi ke RouterOS API
 * @param {Object} config - { ip_address, api_port, api_username, api_password }
 * @returns {RouterOSAPI} - Connected client
 */
const createConnection = (config) => {
  const api = new RouterOSAPI({
    host: config.ip_address,
    port: config.api_port || 8728,
    user: config.api_username,
    password: config.api_password,
    timeout: 5,
    tls: false,
  });
  // Suppress ALL async errors on this connection to prevent process crash
  api.on("error", (err) => {
    console.error("[Mikrotik API Async Error]", err.message || err);
  });
  // Also patch the underlying Channel's onUnknown to swallow !empty silently
  // node-routeros Channel.onUnknown throws an error for !empty which kills promises
  const patchChannels = () => {
    try {
      // Aktifkan TCP Keep-Alive pada raw Socket yang terletak di api.connector.socket
      const socket = api.connector?.socket;
      if (socket && typeof socket.setKeepAlive === "function") {
        socket.setKeepAlive(true, 3000); // Kirim keepalive probe setiap 3 detik
      }
    } catch (_) {}
  };
  api.on("connected", patchChannels);

  // Patch write sekali saja saat pembuatan koneksi
  patchWriteWithTimeout(api);

  return api;
};

// Map untuk menyimpan koneksi aktif: 'ip:username' -> RouterOSAPI instance
const connectionCache = new Map();

/**
 * Memeriksa apakah koneksi TCP masih hidup dan dapat ditulis
 */
const isConnectionAlive = (conn) => {
  try {
    const socket = conn.connector?.socket;
    if (!socket) return false;
    if (socket.destroyed || !socket.writable) return false;
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Melakukan koneksi dengan timeout 5 detik untuk menghindari hang saat jabat tangan API (handshake)
 */
const connectWithTimeout = (conn, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      timer = null;
      try {
        conn.close(true);
      } catch (_) {}
      reject(new Error("Mikrotik API Connection Handshake Timeout (5s)"));
    }, timeoutMs);

    conn
      .connect()
      .then(() => {
        if (timer) {
          clearTimeout(timer);
          resolve();
        }
      })
      .catch((err) => {
        if (timer) {
          clearTimeout(timer);
          reject(err);
        }
      });
  });
};

/**
 * Mendapatkan koneksi yang sudah ada dari cache atau membuat yang baru jika belum ada/terputus
 */
const getOrCreateConnection = async (routerConfig) => {
  const cacheKey = `${routerConfig.ip_address}:${routerConfig.api_username}`;
  let cached = connectionCache.get(cacheKey);

  if (cached) {
    if (isConnectionAlive(cached)) {
      return cached;
    }
    console.log(
      `[Connection Cache] Deteksi koneksi lama mati untuk ${cacheKey}, membuat ulang koneksi...`,
    );
    try {
      cached.close(true);
    } catch (_) {}
    connectionCache.delete(cacheKey);
  }

  const conn = createConnection(routerConfig);
  await connectWithTimeout(conn, 5000);
  connectionCache.set(cacheKey, conn);
  return conn;
};

// Map untuk mengantrekan request secara berurutan pada koneksi yang sama agar tidak tabrakan
const connectionQueue = new Map();

const withConnection = async (routerConfig, fn) => {
  const cacheKey = `${routerConfig.ip_address}:${routerConfig.api_username}`;

  // Inisialisasi antrean untuk router ini jika belum ada
  if (!connectionQueue.has(cacheKey)) {
    connectionQueue.set(cacheKey, Promise.resolve());
  }

  const currentQueue = connectionQueue.get(cacheKey);

  // Jalankan request berikutnya setelah request sebelumnya selesai (Sequential Mutex)
  const nextPromise = currentQueue.then(async () => {
    let conn;
    let usedCache = false;
    try {
      const cached = connectionCache.get(cacheKey);
      if (cached && isConnectionAlive(cached)) {
        usedCache = true;
      }
      conn = await getOrCreateConnection(routerConfig);
      const result = await fn(conn);
      return result;
    } catch (err) {
      console.warn(
        `[Connection Cache] Error terdeteksi: ${err.message}. Mencoba menghubungkan ulang...`,
      );
      const cached = connectionCache.get(cacheKey);
      if (cached) {
        try {
          cached.close(true);
        } catch (_) {}
        connectionCache.delete(cacheKey);
      }

      // Hanya hubungkan ulang & coba lagi jika sebelumnya kita mencoba menggunakan koneksi cache yang ternyata mati/bermasalah
      if (usedCache) {
        try {
          conn = await getOrCreateConnection(routerConfig);
          const result = await fn(conn);
          return result;
        } catch (retryErr) {
          const cachedRetry = connectionCache.get(cacheKey);
          if (cachedRetry) {
            try {
              cachedRetry.close(true);
            } catch (_) {}
            connectionCache.delete(cacheKey);
          }
          const errMsg = retryErr.message || String(retryErr);
          throw new Error(
            `Mikrotik API Error [${routerConfig.ip_address}]: ${errMsg}`,
          );
        }
      } else {
        const errMsg = err.message || String(err);
        throw new Error(
          `Mikrotik API Error [${routerConfig.ip_address}]: ${errMsg}`,
        );
      }
    }
  });

  // Perbarui chain antrean (catch error agar request selanjutnya di antrean tidak terblokir jika request ini gagal)
  connectionQueue.set(
    cacheKey,
    nextPromise.catch(() => {}),
  );

  return nextPromise;
};

// ─── System Information ──────────────────────────────────────────────────────

/**
 * Ambil informasi sistem router (board, version, model)
 */
const getSystemInfo = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const [info] = await conn.write("/system/resource/print");
    const [identity] = await conn.write("/system/identity/print");
    const [routerboard] = await conn.write("/system/routerboard/print");

    return {
      board_name: routerboard?.["board-name"] || "N/A",
      model: routerboard?.["model"] || info?.["board-name"] || "N/A",
      serial: routerboard?.["serial-number"] || "N/A",
      firmware: routerboard?.["firmware"] || "N/A",
      version: info?.["version"] || "N/A",
      identity: identity?.["name"] || "MikroTik",
    };
  });
};

/**
 * Ambil resource router (CPU, Memory, HDD)
 */
const getSystemResources = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const [res] = await conn.write("/system/resource/print");

    const toMB = (bytes) =>
      bytes ? (parseInt(bytes) / 1024 / 1024).toFixed(1) : "0";
    const toPercent = (used, total) =>
      total ? ((parseInt(used) / parseInt(total)) * 100).toFixed(1) : "0";

    const totalMem = parseInt(res["total-memory"] || 0);
    const freeMem = parseInt(res["free-memory"] || 0);
    const usedMem = totalMem - freeMem;

    const totalHdd = parseInt(res["total-hdd-space"] || 0);
    const freeHdd = parseInt(res["free-hdd-space"] || 0);
    const usedHdd = totalHdd - freeHdd;

    return {
      cpu_load: res["cpu-load"] || "0",
      cpu_count: res["cpu-count"] || "1",
      cpu_frequency: res["cpu-frequency"] || "N/A",
      uptime: res["uptime"] || "N/A",
      platform: res["platform"] || "N/A",
      architecture: res["architecture-name"] || "N/A",
      // Memory
      total_memory_mb: toMB(totalMem),
      free_memory_mb: toMB(freeMem),
      used_memory_mb: toMB(usedMem),
      memory_percent: toPercent(usedMem, totalMem),
      // HDD
      total_hdd_mb: toMB(totalHdd),
      free_hdd_mb: toMB(freeHdd),
      used_hdd_mb: toMB(usedHdd),
      hdd_percent: toPercent(usedHdd, totalHdd),
    };
  });
};

/**
 * Ambil tanggal dan waktu sistem router
 */
const getSystemClock = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const [clock] = await conn.write("/system/clock/print");
    return {
      date: clock?.["date"] || "N/A",
      time: clock?.["time"] || "N/A",
      time_zone: clock?.["time-zone-name"] || "N/A",
    };
  });
};

/**
 * Ambil data lengkap dashboard (info + resource + clock dalam 1 koneksi)
 */
const getDashboardData = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const [res] = await conn.write("/system/resource/print");
    const [identity] = await conn.write("/system/identity/print");
    const [routerboard] = await conn.write("/system/routerboard/print");
    const [clock] = await conn.write("/system/clock/print");

    const toMB = (bytes) =>
      bytes ? (parseInt(bytes) / 1024 / 1024).toFixed(1) : "0";
    const toPercent = (used, total) =>
      total ? ((parseInt(used) / parseInt(total)) * 100).toFixed(1) : "0";

    const totalMem = parseInt(res["total-memory"] || 0);
    const freeMem = parseInt(res["free-memory"] || 0);
    const totalHdd = parseInt(res["total-hdd-space"] || 0);
    const freeHdd = parseInt(res["free-hdd-space"] || 0);

    return {
      identity: identity?.["name"] || "MikroTik",
      board_name: routerboard?.["board-name"] || "N/A",
      model: routerboard?.["model"] || res?.["board-name"] || "N/A",
      serial: routerboard?.["serial-number"] || "N/A",
      version: res?.["version"] || "N/A",
      platform: res?.["platform"] || "N/A",
      architecture: res?.["architecture-name"] || "N/A",
      cpu_load: res?.["cpu-load"] || "0",
      uptime: res?.["uptime"] || "N/A",
      total_memory_mb: toMB(totalMem),
      free_memory_mb: toMB(freeMem),
      memory_percent: toPercent(totalMem - freeMem, totalMem),
      total_hdd_mb: toMB(totalHdd),
      free_hdd_mb: toMB(freeHdd),
      hdd_percent: toPercent(totalHdd - freeHdd, totalHdd),
      date: clock?.["date"] || "N/A",
      time: clock?.["time"] || "N/A",
      time_zone: clock?.["time-zone-name"] || "N/A",
    };
  });
};

// ─── Hotspot Active Sessions ─────────────────────────────────────────────────

/**
 * Bersihkan user hotspot sementara dari Mikrotik yang sudah tidak aktif
 * dan dibuat lebih dari 2 menit yang lalu (memberikan jeda waktu untuk proses login).
 */
const cleanupStaleHotspotUsers = async (conn) => {
  try {
    const users = await conn.write("/ip/hotspot/user/print");
    const active = await conn.write("/ip/hotspot/active/print");

    const activeUsernames = new Set(
      active.map((a) => (a.user || "").toLowerCase()),
    );
    const now = Date.now();
    const oneMinute = 60 * 1000;

    for (const u of users) {
      const comment = u.comment || "";
      if (comment.startsWith("temp-")) {
        const username = (u.name || "").toLowerCase();
        // Jika tidak sedang aktif
        if (!activeUsernames.has(username)) {
          const timestampStr = comment.replace("temp-", "");
          const timestamp = parseInt(timestampStr, 10);

          if (!isNaN(timestamp) && now - timestamp > oneMinute) {
            await conn.write("/ip/hotspot/user/remove", [`=.id=${u[".id"]}`]);
            console.log(
              `[Cleanup] Menghapus user sementara kedaluwarsa/diskonek di Mikrotik: ${u.name}`,
            );

            // Hapus Simple Queue jika ada
            try {
              const queues = await conn.write("/queue/simple/print", [
                `?name=hotspot-${u.name}`,
              ]);
              for (const q of queues) {
                await conn.write("/queue/simple/remove", [`=.id=${q[".id"]}`]);
              }
            } catch (_) {}
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Cleanup] Gagal membersihkan user kedaluwarsa:", err.message);
  }
};

// Cache untuk menghitung rate realtime berdasarkan selisih bytes
const activeRateCache = new Map();

/**
 * Ambil daftar user hotspot yang sedang aktif
 */
const getActiveHotspotUsers = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    // Jalankan pembersihan user secara sekuensial agar aman dari tabrakan tag socket API
    try {
      await cleanupStaleHotspotUsers(conn);
    } catch (cleanupErr) {
      console.warn("[Cleanup Error]", cleanupErr.message);
    }

    const sessions = await conn.write("/ip/hotspot/active/print");

    // Ambil data queue/simple untuk mendapatkan rate bawaan queue jika ada
    let queueMap = new Map();
    try {
      const queues = await conn.write("/queue/simple/print");
      for (const q of queues) {
        if (q.target) {
          const ip = q.target.split("/")[0];
          queueMap.set(ip, q.rate || "");
        }
        if (q.name) {
          queueMap.set(q.name, q.rate || "");
        }
      }
    } catch (_) {}

    const now = Date.now();

    return sessions.map((s) => {
      const userIp = s["address"] || "";
      const username = s["user"] || "";
      const queueName = `hotspot-${username}`;

      const bytesIn = parseInt(s["bytes-in"] || "0", 10) || 0;
      const bytesOut = parseInt(s["bytes-out"] || "0", 10) || 0;

      let rxBps = 0; // Upload bps
      let txBps = 0; // Download bps

      // 1. Coba ambil dari queue rate ("rx_bps/tx_bps")
      const qRate = queueMap.get(userIp) || queueMap.get(queueName) || "";
      if (qRate && qRate.includes("/")) {
        const parts = qRate.split("/");
        rxBps = parseInt(parts[0], 10) || 0;
        txBps = parseInt(parts[1], 10) || 0;
      }

      // 2. Hitung selisih byte per detik (delta calculation) jika queue rate 0
      const cacheKey = `${routerConfig.ip_address}:${userIp || username}`;
      const prev = activeRateCache.get(cacheKey);

      if (prev && prev.timestamp < now) {
        const dt = (now - prev.timestamp) / 1000;
        if (dt > 0.5) {
          const deltaRx = Math.max(0, bytesIn - prev.bytesIn);
          const deltaTx = Math.max(0, bytesOut - prev.bytesOut);

          const calcRxBps = Math.round((deltaRx * 8) / dt);
          const calcTxBps = Math.round((deltaTx * 8) / dt);

          if (rxBps === 0) rxBps = calcRxBps;
          if (txBps === 0) txBps = calcTxBps;
        }
      }

      // Simpan sampel terbaru ke cache
      activeRateCache.set(cacheKey, {
        bytesIn,
        bytesOut,
        timestamp: now,
      });

      return {
        id: s[".id"] || "",
        user: username,
        domain: s["domain"] || "",
        address: userIp,
        mac: s["mac-address"] || "",
        "mac-address": s["mac-address"] || "",
        uptime: s["uptime"] || "",
        bytes_in: s["bytes-in"] || "0",
        bytes_out: s["bytes-out"] || "0",
        "bytes-in": s["bytes-in"] || "0",
        "bytes-out": s["bytes-out"] || "0",
        rx_rate: rxBps,
        tx_rate: txBps,
        "rx-rate": rxBps,
        "tx-rate": txBps,
        packets_in: s["packets-in"] || "0",
        packets_out: s["packets-out"] || "0",
        server: s["server"] || "",
        comment: s["comment"] || "",
      };
    });
  });
};

// ─── Hotspot User Management (Dynamic) ──────────────────────────────────────

/**
 * Buat hotspot user sementara di Mikrotik untuk sesi login
 * @param {Object} routerConfig
 * @param {string} username
 * @param {string} password
 * @param {string} profile - nama profile (default: 'default')
 * @param {string} mac - MAC address user (opsional)
 */
const createHotspotUser = async (
  routerConfig,
  username,
  password,
  profile = "default",
  mac = "",
) => {
  return withConnection(routerConfig, async (conn) => {
    // Cek apakah user sudah ada
    const existing = await conn.write("/ip/hotspot/user/print", [
      `?name=${username}`,
    ]);

    if (existing && existing.length > 0) {
      // Update password jika sudah ada
      await conn.write("/ip/hotspot/user/set", [
        `=.id=${existing[0][".id"]}`,
        `=password=${password}`,
        `=profile=${profile}`,
      ]);
      return { action: "updated", id: existing[0][".id"] };
    }

    // Buat user baru
    const args = [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=${profile}`,
    ];
    if (mac) args.push(`=mac-address=${mac}`);

    const result = await conn.write("/ip/hotspot/user/add", args);
    return { action: "created", id: result[0]?.["ret"] || "" };
  });
};

/**
 * Hapus hotspot user sementara dari Mikrotik (setelah logout/expired)
 */
const removeHotspotUser = async (routerConfig, username) => {
  return withConnection(routerConfig, async (conn) => {
    const users = await conn.write("/ip/hotspot/user/print", [
      `?name=${username}`,
    ]);
    if (users && users.length > 0) {
      await conn.write("/ip/hotspot/user/remove", [`=.id=${users[0][".id"]}`]);
    }
    return { removed: true };
  });
};

/**
 * Disconnect user aktif dari hotspot
 */
const disconnectActiveUser = async (routerConfig, username) => {
  return withConnection(routerConfig, async (conn) => {
    const sessions = await conn.write("/ip/hotspot/active/print", [
      `?user=${username}`,
    ]);
    for (const s of sessions) {
      await conn.write("/ip/hotspot/active/remove", [`=.id=${s[".id"]}`]);
    }
    return { disconnected: sessions.length };
  });
};

// ─── Simple Queue (Bandwidth Limiting) ──────────────────────────────────────

/**
 * Buat atau update Simple Queue untuk user
 * @param {Object} routerConfig
 * @param {string} username
 * @param {string} targetIp - IP address user di hotspot
 * @param {string} limit - Format "download/upload", e.g. "10M/10M" or "2M/512k"
 */
const upsertSimpleQueue = async (routerConfig, username, targetIp, limit) => {
  return withConnection(routerConfig, async (conn) => {
    const queueName = `hotspot-${username}`;

    const existing = await conn.write("/queue/simple/print", [
      `?name=${queueName}`,
    ]);

    if (existing && existing.length > 0) {
      // Update queue yang ada
      await conn.write("/queue/simple/set", [
        `=.id=${existing[0][".id"]}`,
        `=target=${targetIp}/32`,
        `=max-limit=${limit}`,
      ]);
      return { action: "updated", name: queueName };
    }

    // Buat queue baru
    await conn.write("/queue/simple/add", [
      `=name=${queueName}`,
      `=target=${targetIp}/32`,
      `=max-limit=${limit}`,
      `=comment=Hotspot user: ${username}`,
    ]);
    return { action: "created", name: queueName };
  });
};

/**
 * Hapus Simple Queue user
 */
const removeSimpleQueue = async (routerConfig, username) => {
  return withConnection(routerConfig, async (conn) => {
    const queueName = `hotspot-${username}`;
    const existing = await conn.write("/queue/simple/print", [
      `?name=${queueName}`,
    ]);
    if (existing && existing.length > 0) {
      await conn.write("/queue/simple/remove", [`=.id=${existing[0][".id"]}`]);
    }
    return { removed: true, name: queueName };
  });
};

/**
 * Update bandwidth limit user secara realtime
 * (Hanya update max-limit pada queue yang sudah ada)
 */
const updateBandwidthLimit = async (routerConfig, username, newLimit) => {
  return withConnection(routerConfig, async (conn) => {
    const queueName = `hotspot-${username}`;
    const existing = await conn.write("/queue/simple/print", [
      `?name=${queueName}`,
    ]);
    if (existing && existing.length > 0) {
      await conn.write("/queue/simple/set", [
        `=.id=${existing[0][".id"]}`,
        `=max-limit=${newLimit}`,
      ]);
      return { updated: true, name: queueName, limit: newLimit };
    }
    return {
      updated: false,
      message: "Queue tidak ditemukan (user mungkin offline)",
    };
  });
};

// ─── Firewall Address List (Website Blocking) ────────────────────────────────

const BLOCK_ADDRESS_LIST = "hotspot-blocked-users";
const BLOCK_DST_ADDRESS_LIST = "npma-blocked";

/**
 * Tambahkan IP user ke firewall address-list untuk pemblokiran situs
 */
const addUserToBlockList = async (routerConfig, userIp, username) => {
  return withConnection(routerConfig, async (conn) => {
    // Cek apakah sudah ada
    const existing = await conn.write("/ip/firewall/address-list/print", [
      `?list=${BLOCK_ADDRESS_LIST}`,
      `?address=${userIp}`,
    ]);

    if (!existing || existing.length === 0) {
      await conn.write("/ip/firewall/address-list/add", [
        `=list=${BLOCK_ADDRESS_LIST}`,
        `=address=${userIp}`,
        `=comment=Block user: ${username}`,
      ]);
    }
    return { blocked: true, ip: userIp, list: BLOCK_ADDRESS_LIST };
  });
};

/**
 * Hapus IP user dari firewall address-list (unblock)
 */
const removeUserFromBlockList = async (routerConfig, userIp) => {
  return withConnection(routerConfig, async (conn) => {
    const entries = await conn.write("/ip/firewall/address-list/print", [
      `?list=${BLOCK_ADDRESS_LIST}`,
      `?address=${userIp}`,
    ]);
    for (const entry of entries) {
      await conn.write("/ip/firewall/address-list/remove", [
        `=.id=${entry[".id"]}`,
      ]);
    }
    return { unblocked: true, ip: userIp };
  });
};

/**
 * Test koneksi ke router
 */
const testConnection = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const [identity] = await conn.write("/system/identity/print");
    return {
      success: true,
      identity: identity?.["name"] || "MikroTik",
    };
  });
};

/**
 * Hapus semua koneksi aktif untuk IP tertentu di connection tracking table Mikrotik.
 * Hal ini diperlukan karena penyaringan Layer 7 hanya memeriksa beberapa paket pertama dari
 * koneksi baru. Jika koneksi sudah terlanjur "established", L7 tidak akan mendeteksinya lagi.
 * Dengan menghapus koneksi aktif, perangkat dipaksa membuat koneksi baru yang langsung terblokir.
 */
const clearConnectionsForIp = async (conn, ip) => {
  try {
    // Ambil semua koneksi lalu filter secara lokal di NodeJS untuk menghindari error !empty crash di Mikrotik RouterOS
    const allConnections = await conn.write("/ip/firewall/connection/print");

    const toRemove = new Set();
    if (allConnections) {
      allConnections.forEach((c) => {
        const src = c["src-address"] || "";
        const dst = c["dst-address"] || "";
        if (src.includes(ip) || dst.includes(ip)) {
          if (c[".id"]) toRemove.add(c[".id"]);
        }
      });
    }

    if (toRemove.size > 0) {
      for (const id of toRemove) {
        try {
          await conn.write("/ip/firewall/connection/remove", [`=.id=${id}`]);
        } catch (_) {
          // Abaikan jika koneksi sudah tertutup sendiri
        }
      }
    }
  } catch (err) {
    console.warn(
      "[Mikrotik] Gagal membersihkan koneksi untuk IP:",
      ip,
      err.message,
    );
  }
};

/**
 * Buat/update user hotspot, simple queue, dan status blokir dalam SATU koneksi saja
 * untuk menghindari overhead overhead TCP connect/close berulang kali yang memicu timeout.
 */
const setupPortalUser = async (
  routerConfig,
  username,
  password,
  ip,
  mac,
  bandwidthLimit,
  websiteBlock,
) => {
  return withConnection(routerConfig, async (conn) => {
    // 1. Buat/Update Hotspot User
    const existingUser = await conn.write("/ip/hotspot/user/print", [
      `?name=${username}`,
    ]);

    if (existingUser && existingUser.length > 0) {
      await conn.write("/ip/hotspot/user/remove", [
        `=.id=${existingUser[0][".id"]}`,
      ]);
    }

    await conn.write("/ip/hotspot/user/add", [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=default`,
      `=comment=temp-${Date.now()}`,
    ]);

    // 1.5. Bersihkan IP Binding lama (jika ada sisa bypass) agar user wajib autentikasi via Captive Portal
    if (mac || ip) {
      try {
        const allBindings = await conn.write("/ip/hotspot/ip-binding/print");
        const targetMac = mac ? mac.toLowerCase().trim() : "";
        for (const b of allBindings) {
          const bMac = (b["mac-address"] || "").toLowerCase().trim();
          const bAddr = (b["address"] || "").trim();
          if ((targetMac && bMac === targetMac) || (ip && bAddr === ip)) {
            try {
              await conn.write("/ip/hotspot/ip-binding/remove", [`=.id=${b[".id"]}`]);
            } catch (_) {}
          }
        }
      } catch (bindingErr) {
        console.warn("[setupPortalUser] IP Binding cleanup error:", bindingErr.message);
      }

      // 1.6. Otorisasi instan ke /ip/hotspot/active via RouterOS API
      try {
        const activeArgs = [
          `=user=${username}`,
          `=password=${password}`,
        ];
        if (ip) activeArgs.push(`=ip=${ip}`);
        if (mac) activeArgs.push(`=mac-address=${mac}`);
        await conn.write("/ip/hotspot/active/login", activeArgs);
        console.log(`[setupPortalUser] Active user login successful via API for ${username}`);
      } catch (activeErr) {
        console.warn("[setupPortalUser] Active login via API notice:", activeErr.message);
      }
    }

    // 2. Buat/Update Simple Queue jika ada IP dan Limit
    if (ip && bandwidthLimit) {
      const queueName = `hotspot-${username}`;

      // Hapus semua queue yang conflict: baik berdasarkan nama username NOR target IP yang sama
      const allQueues = await conn.write("/queue/simple/print");
      for (const q of allQueues) {
        const qTarget = q.target || "";
        const qIp = qTarget.split("/")[0];
        const nameMatch = q.name === queueName;
        const ipMatch = qIp === ip;
        if (nameMatch || ipMatch) {
          try {
            await conn.write("/queue/simple/remove", [`=.id=${q[".id"]}`]);
          } catch (_) {}
        }
      }

      // Tambahkan queue baru (selalu fresh, tanpa risiko duplicate)
      await conn.write("/queue/simple/add", [
        `=name=${queueName}`,
        `=target=${ip}`,
        `=max-limit=${bandwidthLimit.toUpperCase()}`,
      ]);
    }

    // 3. Setup blokir situs menggunakan Layer7 Protocol & IP Address List (Lapis Ganda)
    const blockedSites = (websiteBlock || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const blockConfigs = {
      npma: {
        userList: "hotspot-blocked-npma",
        domainList: "npma-blocked",
        domains: ["npma.my.id"],
        l7Name: "npma-block",
        regexp: "npma\\.my\\.id",
      },
      youtube: {
        userList: "hotspot-blocked-youtube",
        domainList: "youtube-blocked",
        domains: ["youtube.com", "www.youtube.com", "googlevideo.com", "ytimg.com", "youtu.be"],
        l7Name: "youtube-block",
        regexp: "youtube|googlevideo|ytimg|youtu.be",
      },
    };

    if (ip) {
      // Ambil data yang diperlukan sekaligus
      const allAddressLists = await conn.write("/ip/firewall/address-list/print");
      const allFilters = await conn.write("/ip/firewall/filter/print");

      // Bersihkan rule-rule sisa/berantakan yang tidak perlu (satu kali jika ada)
      try {
        const allNatRules = await conn.write("/ip/firewall/nat/print");
        for (const rule of allNatRules) {
          const isDnsRedirect =
            rule.chain === "dstnat" &&
            rule.action === "redirect" &&
            rule["dst-port"] === "53" &&
            rule.comment &&
            (rule.comment.includes("Redirect client DNS") || rule.comment.includes("Redirect DNS to local"));
          if (isDnsRedirect) {
            try { await conn.write("/ip/firewall/nat/remove", [`=.id=${rule[".id"]}`]); } catch (_) {}
          }
        }
      } catch (_) {}

      // Bersihkan filter rule lama yang pakai doh-servers
      for (const rule of allFilters) {
        if (rule["dst-address-list"] === "doh-servers") {
          try { await conn.write("/ip/firewall/filter/remove", [`=.id=${rule[".id"]}`]); } catch (_) {}
        }
      }

      for (const [siteKey, cfg] of Object.entries(blockConfigs)) {
        // A. Pastikan domain-domain terdaftar di dst-address-list Mikrotik untuk dynamic resolving
        for (const domain of cfg.domains) {
          const domainExists = allAddressLists.some(
            (entry) => entry.list === cfg.domainList && entry.address === domain,
          );
          if (!domainExists) {
            await conn.write("/ip/firewall/address-list/add", [
              `=list=${cfg.domainList}`,
              `=address=${domain}`,
              `=comment=Target domain for ${siteKey} block`,
            ]);
          }
        }

        // B. Pastikan rule firewall filter drop berbasis IP (mencegah established connections lolos)
        const ipFilterExists = allFilters.some(
          (rule) =>
            rule.chain === "forward" &&
            rule["src-address-list"] === cfg.userList &&
            rule["dst-address-list"] === cfg.domainList,
        );
        if (!ipFilterExists) {
          const args = [
            `=chain=forward`,
            `=src-address-list=${cfg.userList}`,
            `=dst-address-list=${cfg.domainList}`,
            `=action=drop`,
            `=comment=Block ${siteKey} established connections via IP list`,
          ];
          if (allFilters && allFilters.length > 0) args.push(`=place-before=0`);
          await conn.write("/ip/firewall/filter/add", args);
        }

        // C. Pastikan L7 Protocol terdaftar
        const allL7s = await conn.write("/ip/firewall/layer7-protocol/print");
        const existingL7 = allL7s.find((entry) => entry.name === cfg.l7Name);
        if (!existingL7) {
          await conn.write("/ip/firewall/layer7-protocol/add", [
            `=name=${cfg.l7Name}`,
            `=regexp=${cfg.regexp}`,
          ]);
        } else if (existingL7.regexp !== cfg.regexp) {
          await conn.write("/ip/firewall/layer7-protocol/set", [
            `=.id=${existingL7[".id"]}`,
            `=regexp=${cfg.regexp}`,
          ]);
        }

        // D. Pastikan filter rule L7 ada
        const filterExists = allFilters.some(
          (rule) =>
            rule.chain === "forward" &&
            rule["src-address-list"] === cfg.userList &&
            rule["layer7-protocol"] === cfg.l7Name,
        );
        if (!filterExists) {
          const args = [
            `=chain=forward`,
            `=src-address-list=${cfg.userList}`,
            `=layer7-protocol=${cfg.l7Name}`,
            `=action=drop`,
            `=comment=Block ${siteKey} via L7`,
          ];
          if (allFilters && allFilters.length > 0) args.push(`=place-before=0`);
          await conn.write("/ip/firewall/filter/add", args);
        }

        // E. Pastikan filter rule drop QUIC/UDP 443 ada (bypass L7 untuk QUIC)
        const quicFilterExists = allFilters.some(
          (rule) =>
            rule.chain === "forward" &&
            rule["src-address-list"] === cfg.userList &&
            rule.protocol === "udp" &&
            rule["dst-port"] === "443",
        );
        if (!quicFilterExists) {
          const args = [
            `=chain=forward`,
            `=src-address-list=${cfg.userList}`,
            `=protocol=udp`,
            `=dst-port=443`,
            `=action=drop`,
            `=comment=Block QUIC UDP 443 for ${siteKey}`,
          ];
          if (allFilters && allFilters.length > 0) args.push(`=place-before=0`);
          await conn.write("/ip/firewall/filter/add", args);
        }

        // F. Masukkan/hapus IP user ke address-list sesuai status blokir
        const isBlocked = blockedSites.includes(siteKey);
        const targetComment = `Block ${siteKey} for ${username}`;
        
        // Cari semua entri address list milik user ini (baik IP lama dari comment, maupun IP aktif saat ini)
        const existingUserBlock = allAddressLists.filter(
          (entry) =>
            entry.list === cfg.userList &&
            (entry.comment === targetComment || entry.address === ip),
        );

        if (isBlocked) {
          const hasCurrentIp = existingUserBlock.some((entry) => entry.address === ip);
          if (!hasCurrentIp) {
            await conn.write("/ip/firewall/address-list/add", [
              `=list=${cfg.userList}`,
              `=address=${ip}`,
              `=comment=${targetComment}`,
            ]);
            await clearConnectionsForIp(conn, ip);
          }
          // Bersihkan sisa IP lama milik user ini jika ada pergantian IP DHCP
          for (const entry of existingUserBlock) {
            if (entry.address !== ip) {
              try {
                await conn.write("/ip/firewall/address-list/remove", [`=.id=${entry[".id"]}`]);
                await clearConnectionsForIp(conn, entry.address);
              } catch (_) {}
            }
          }
        } else {
          // Hapus semua IP (lama maupun baru) milik user ini dari address-list
          let hasRemoved = false;
          for (const entry of existingUserBlock) {
            try {
              await conn.write("/ip/firewall/address-list/remove", [`=.id=${entry[".id"]}`]);
              await clearConnectionsForIp(conn, entry.address);
              hasRemoved = true;
            } catch (_) {}
          }

          // Cek apakah masih ada user lain yang diblokir di userList ini
          // Kita ambil data address-list terbaru untuk akurasi data
          const freshAddressLists = await conn.write("/ip/firewall/address-list/print");
          const remainingBlockedUsers = freshAddressLists.filter(
            (entry) => entry.list === cfg.userList,
          );

          // Jika tidak ada user lain yang diblokir, hapus juga filter rules, L7, dan target domain list
          if (remainingBlockedUsers.length === 0) {
            // Hapus filter rules yang menggunakan userList ini (termasuk drop IP, drop L7, dan drop QUIC)
            const freshFilters = await conn.write("/ip/firewall/filter/print");
            for (const rule of freshFilters) {
              if (rule["src-address-list"] === cfg.userList) {
                try { await conn.write("/ip/firewall/filter/remove", [`=.id=${rule[".id"]}`]); } catch (_) {}
              }
            }
            // Hapus L7 Protocol definition
            const freshL7s = await conn.write("/ip/firewall/layer7-protocol/print");
            const l7Entry = freshL7s.find((entry) => entry.name === cfg.l7Name);
            if (l7Entry) {
              try { await conn.write("/ip/firewall/layer7-protocol/remove", [`=.id=${l7Entry[".id"]}`]); } catch (_) {}
            }
            // Hapus domain list untuk situs ini dari address-list
            for (const entry of freshAddressLists) {
              if (entry.list === cfg.domainList) {
                try { await conn.write("/ip/firewall/address-list/remove", [`=.id=${entry[".id"]}`]); } catch (_) {}
              }
            }
          }
        }
      }
    }

    return { success: true };
  });
};


/**
 * Ambil daftar DHCP leases dari Mikrotik
 */

const getDhcpLeases = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const leases = await conn.write("/ip/dhcp-server/lease/print");
    return leases.map((l) => ({
      id: l[".id"] || "",
      address: l["address"] || "",
      mac_address: l["mac-address"] || "",
      client_id: l["client-id"] || "",
      server: l["server"] || "",
      status: l["status"] || "",
      host_name: l["host-name"] || "",
      expires_after: l["expires-after"] || "",
      comment: l["comment"] || "",
      dynamic: l["dynamic"] || "false",
    }));
  });
};

/**
 * Hapus DHCP lease dari Mikrotik
 */
const removeDhcpLease = async (routerConfig, leaseId) => {
  return withConnection(routerConfig, async (conn) => {
    // 1. Dapatkan info lease sebelum dihapus
    const leaseResult = await conn.write("/ip/dhcp-server/lease/print", [
      `?.id=${leaseId}`,
    ]);

    if (leaseResult && leaseResult.length > 0) {
      const rawMac = leaseResult[0]["mac-address"];
      const ip = leaseResult[0]["address"];

      // 2. Hapus lease
      await conn.write("/ip/dhcp-server/lease/remove", [`=.id=${leaseId}`]);

      if (rawMac) {
        const macLower = rawMac.toLowerCase().trim();
        console.log(
          `[removeDhcpLease] Cascading cleanup started for MAC: ${macLower}`,
        );

        // 3. Putuskan hubungan wireless (deauth) agar HP terputus fisik
        try {
          const regTable = await conn.write(
            "/interface/wireless/registration-table/print",
          );
          for (const reg of regTable) {
            const rMac = (reg["mac-address"] || "").toLowerCase().trim();
            if (rMac === macLower) {
              await conn.write(
                "/interface/wireless/registration-table/remove",
                [`=.id=${reg[".id"]}`],
              );
            }
          }
        } catch (regErr) {
          console.warn(
            "[removeDhcpLease] Wireless deauth error:",
            regErr.message,
          );
        }

        // 4. Hapus host hotspot
        try {
          const hosts = await conn.write("/ip/hotspot/host/print");
          for (const h of hosts) {
            const hMac = (h["mac-address"] || "").toLowerCase().trim();
            if (hMac === macLower) {
              await conn.write("/ip/hotspot/host/remove", [`=.id=${h[".id"]}`]);
            }
          }
        } catch (hostErr) {
          console.warn("[removeDhcpLease] Host remove error:", hostErr.message);
        }

        // 5. Hapus sesi hotspot aktif
        try {
          const actives = await conn.write("/ip/hotspot/active/print");
          let username = "";
          for (const a of actives) {
            const aMac = (a["mac-address"] || "").toLowerCase().trim();
            if (aMac === macLower) {
              username = a.user;
              await conn.write("/ip/hotspot/active/remove", [
                `=.id=${a[".id"]}`,
              ]);
            }
          }

          // Cek DB jika username kosong (client sudah offline di router tapi user lokal temp- masih tertinggal)
          let dbUsername = "";
          if (!username) {
            try {
              const { query } = require("../config/db");
              const dbRes = await query(
                `
                                SELECT u.username 
                                FROM active_sessions s 
                                JOIN hotspot_users u ON s.hotspot_user_id = u.id 
                                WHERE LOWER(s.mac_address) = LOWER($1)
                                ORDER BY s.login_at DESC 
                                LIMIT 1
                            `,
                [macLower],
              );
              if (dbRes && dbRes.rows.length > 0) {
                dbUsername = dbRes.rows[0].username;
              }
            } catch (dbErr) {
              console.warn(
                "[removeDhcpLease] Failed to fetch username from DB fallback:",
                dbErr.message,
              );
            }
          }

          // 6. Hapus user hotspot lokal jika temporary
          const targetUsername = (username || dbUsername || "").trim();
          if (targetUsername) {
            const localUsers = await conn.write("/ip/hotspot/user/print", [
              `?name=${targetUsername}`,
            ]);
            for (const u of localUsers) {
              const comment = u.comment || "";
              if (comment.startsWith("temp-")) {
                await conn.write("/ip/hotspot/user/remove", [
                  `=.id=${u[".id"]}`,
                ]);

                // Hapus Simple Queue jika ada
                try {
                  const queues = await conn.write("/queue/simple/print", [
                    `?name=hotspot-${targetUsername}`,
                  ]);
                  for (const q of queues) {
                    await conn.write("/queue/simple/remove", [
                      `=.id=${q[".id"]}`,
                    ]);
                  }
                } catch (_) {}
              }
            }
          }
        } catch (activeErr) {
          console.warn(
            "[removeDhcpLease] Active/User remove error:",
            activeErr.message,
          );
        }
      }

      // 7. Bersihkan sisa koneksi firewall
      if (ip) {
        await clearConnectionsForIp(conn, ip).catch(() => {});
      }
    } else {
      await conn.write("/ip/dhcp-server/lease/remove", [`=.id=${leaseId}`]);
    }

    return { success: true };
  });
};

/**
 * Ambil daftar host hotspot (perangkat nirkabel yang terhubung)
 */
const getHotspotHosts = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const hosts = await conn.write("/ip/hotspot/host/print");
    return hosts.map((h) => ({
      id: h[".id"] || "",
      mac_address: h["mac-address"] || "",
      address: h["address"] || "",
      to_address: h["to-address"] || "",
      server: h["server"] || "",
      uptime: h["uptime"] || "",
      keepalive: h["keepalive-timeout"] || "",
      authorized: h["authorized"] || "false",
      bypassed: h["bypassed"] || "false",
      comment: h["comment"] || "",
    }));
  });
};

/**
 * Hapus host hotspot dari router
 */
const removeHotspotHost = async (routerConfig, hostId) => {
  return withConnection(routerConfig, async (conn) => {
    await conn.write("/ip/hotspot/host/remove", [`=.id=${hostId}`]);
    return { success: true };
  });
};

/**
 * Toggle bypass status host di IP Binding Mikrotik
 */
const toggleHotspotHostBypass = async (routerConfig, mac, shouldBypass) => {
  return withConnection(routerConfig, async (conn) => {
    // Cek apakah binding untuk MAC ini sudah ada
    const existing = await conn.write("/ip/hotspot/ip-binding/print", [
      `?mac-address=${mac}`,
    ]);

    if (existing && existing.length > 0) {
      if (shouldBypass) {
        // Set to bypassed
        await conn.write("/ip/hotspot/ip-binding/set", [
          `=.id=${existing[0][".id"]}`,
          `=type=bypassed`,
          `=comment=Bypass via Web Dashboard`,
        ]);
      } else {
        // Hapus binding agar kembali ke normal hotspot auth
        await conn.write("/ip/hotspot/ip-binding/remove", [
          `=.id=${existing[0][".id"]}`,
        ]);
      }
    } else if (shouldBypass) {
      // Tambahkan binding baru
      await conn.write("/ip/hotspot/ip-binding/add", [
        `=mac-address=${mac}`,
        `=type=bypassed`,
        `=comment=Bypass via Web Dashboard`,
      ]);
    }
    return { success: true };
  });
};

/**
 * Ambil daftar user hotspot lokal yang terdaftar di router
 */
const getRouterHotspotUsers = async (routerConfig) => {
  return withConnection(routerConfig, async (conn) => {
    const users = await conn.write("/ip/hotspot/user/print");
    return users.map((u) => ({
      id: u[".id"] || "",
      name: u["name"] || "",
      password: u["password"] || "",
      profile: u["profile"] || "",
      limit_bytes_out: u["limit-bytes-out"] || "",
      limit_uptime: u["limit-uptime"] || "",
      comment: u["comment"] || "",
    }));
  });
};

/**
 * Hapus user hotspot lokal dari router berdasarkan ID Mikrotik
 */
const removeRouterHotspotUser = async (routerConfig, userId) => {
  return withConnection(routerConfig, async (conn) => {
    await conn.write("/ip/hotspot/user/remove", [`=.id=${userId}`]);
    return { success: true };
  });
};

/**
 * Hapus user hotspot lokal dari router berdasarkan username (mencari .id terlebih dahulu)
 */
const removeRouterHotspotUserByName = async (routerConfig, username) => {
  return withConnection(routerConfig, async (conn) => {
    const users = await conn.write("/ip/hotspot/user/print", [
      `?name=${username}`,
    ]);
    for (const u of users) {
      await conn.write("/ip/hotspot/user/remove", [`=.id=${u[".id"]}`]);
    }
    return { success: true, removed: users.length };
  });
};

/**
 * Hapus/kick sesi hotspot aktif berdasarkan ID
 */
const removeHotspotActive = async (routerConfig, activeId) => {
  return withConnection(routerConfig, async (conn) => {
    // 1. Dapatkan info active session sebelum dihapus
    const activeResult = await conn.write("/ip/hotspot/active/print", [
      `?.id=${activeId}`,
    ]);

    if (activeResult && activeResult.length > 0) {
      const rawMac = activeResult[0]["mac-address"];
      const ip = activeResult[0]["address"];
      const username = activeResult[0]["user"];

      // 2. Hapus sesi aktif
      await conn.write("/ip/hotspot/active/remove", [`=.id=${activeId}`]);

      if (rawMac) {
        const macLower = rawMac.toLowerCase().trim();

        // 3. Putuskan hubungan wireless (deauth) agar HP terputus fisik
        const regTable = await conn.write(
          "/interface/wireless/registration-table/print",
        );
        for (const reg of regTable) {
          const rMac = (reg["mac-address"] || "").toLowerCase().trim();
          if (rMac === macLower) {
            await conn.write("/interface/wireless/registration-table/remove", [
              `=.id=${reg[".id"]}`,
            ]);
          }
        }

        // 4. Hapus host hotspot
        const hosts = await conn.write("/ip/hotspot/host/print");
        for (const h of hosts) {
          const hMac = (h["mac-address"] || "").toLowerCase().trim();
          if (hMac === macLower) {
            await conn.write("/ip/hotspot/host/remove", [`=.id=${h[".id"]}`]);
          }
        }

        // 5. Hapus DHCP Lease dynamic
        const leases = await conn.write("/ip/dhcp-server/lease/print");
        for (const l of leases) {
          const lMac = (l["mac-address"] || "").toLowerCase().trim();
          if (lMac === macLower && l.dynamic === "true") {
            await conn.write("/ip/dhcp-server/lease/remove", [
              `=.id=${l[".id"]}`,
            ]);
          }
        }

        // 6. Hapus user hotspot lokal jika temporary
        if (username) {
          const localUsers = await conn.write("/ip/hotspot/user/print", [
            `?name=${username}`,
          ]);
          for (const u of localUsers) {
            const comment = u.comment || "";
            if (comment.startsWith("temp-")) {
              await conn.write("/ip/hotspot/user/remove", [`=.id=${u[".id"]}`]);

              // Hapus Simple Queue jika ada
              try {
                const queues = await conn.write("/queue/simple/print", [
                  `?name=hotspot-${username}`,
                ]);
                for (const q of queues) {
                  await conn.write("/queue/simple/remove", [
                    `=.id=${q[".id"]}`,
                  ]);
                }
              } catch (_) {}
            }
          }
        }
      }

      // 7. Bersihkan sisa koneksi firewall
      if (ip) {
        await clearConnectionsForIp(conn, ip).catch(() => {});
      }
    } else {
      await conn.write("/ip/hotspot/active/remove", [`=.id=${activeId}`]);
    }

    return { success: true };
  });
};

module.exports = {
  getDashboardData,
  getSystemInfo,
  getSystemResources,
  getSystemClock,
  getActiveHotspotUsers,
  createHotspotUser,
  removeHotspotUser,
  disconnectActiveUser,
  upsertSimpleQueue,
  removeSimpleQueue,
  updateBandwidthLimit,
  addUserToBlockList,
  removeUserFromBlockList,
  testConnection,
  setupPortalUser,
  BLOCK_ADDRESS_LIST,
  getDhcpLeases,
  removeDhcpLease,
  getHotspotHosts,
  removeHotspotHost,
  toggleHotspotHostBypass,
  getRouterHotspotUsers,
  removeRouterHotspotUser,
  removeRouterHotspotUserByName,
  removeHotspotActive,
};
