const { query }          = require('../config/db');
const mikrotik           = require('../services/mikrotikService');

/**
 * Helper: Ambil konfigurasi router dari DB berdasarkan ID
 */
const getRouterConfig = async (routerId) => {
    const result = await query('SELECT * FROM routers WHERE id = $1 AND is_active = TRUE', [routerId]);
    if (result.rows.length === 0) throw new Error('Router tidak ditemukan atau tidak aktif.');
    return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/portal/login
 * Alur login captive portal:
 *  1. Validasi user ke DB
 *  2. Buat hotspot user sementara di Mikrotik
 *  3. Buat Simple Queue sesuai bandwidth limit
 *  4. Jika diblokir, tambahkan ke firewall address-list
 *  5. Kembalikan link untuk authenticate ke Mikrotik
 */
const portalLogin = async (req, res) => {
    const { username, password, ip, mac, router_id, link_login } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    try {
        // 1. Cari user di database
        const userResult = await query(
            `SELECT hu.*, r.ip_address as router_ip, r.api_port, r.api_username, r.api_password,
                    r.name as router_name
             FROM hotspot_users hu
             LEFT JOIN routers r ON hu.router_id = r.id
             WHERE hu.username = $1 AND hu.is_active = TRUE`,
            [username.toLowerCase().trim()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const user = userResult.rows[0];

        // 2. Validasi password (plain text - sesuai kebutuhan hotspot)
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        // 3. Tentukan router target
        let routerConfig = null;

        // Coba deteksi dari link_login yang dikirim oleh portal login
        if (link_login) {
            let detectedRouterIp = null;
            try {
                const url = new URL(link_login);
                detectedRouterIp = url.hostname;
            } catch (_) {
                const match = link_login.match(/https?:\/\/([^\/:]+)/);
                if (match) detectedRouterIp = match[1];
            }

            if (detectedRouterIp) {
                const rResult = await query('SELECT * FROM routers WHERE ip_address = $1 AND is_active = TRUE', [detectedRouterIp]);
                if (rResult.rows.length > 0) {
                    routerConfig = rResult.rows[0];
                }
            }
        }

        // Fallback ke router_id dari request body jika tidak terdeteksi dari link_login
        if (!routerConfig && router_id) {
            const rResult = await query('SELECT * FROM routers WHERE id = $1 AND is_active = TRUE', [router_id]);
            if (rResult.rows.length > 0) {
                routerConfig = rResult.rows[0];
            }
        }

        // Fallback ke user.router_id dari profile DB jika masih belum terdeteksi
        if (!routerConfig && user.router_id) {
            const rResult = await query('SELECT * FROM routers WHERE id = $1 AND is_active = TRUE', [user.router_id]);
            if (rResult.rows.length > 0) {
                routerConfig = rResult.rows[0];
            }
        }

        if (!routerConfig) {
            return res.status(400).json({ success: false, message: 'Router tidak terkonfigurasi untuk user ini.' });
        }

        // Jika user dibatasi hanya untuk router tertentu (user.router_id tidak null), pastikan router yang dituju sesuai
        if (user.router_id && user.router_id !== routerConfig.id) {
            return res.status(403).json({ success: false, message: 'Akun Anda tidak terdaftar untuk digunakan di router ini.' });
        }

        // 4. Cek apakah username sudah memiliki sesi aktif di Mikrotik
        //    Jika ya, bandingkan MAC address untuk membedakan stale session (device sama) vs double login (device beda)
        try {
            const activeSessions = await mikrotik.getActiveHotspotUsers(routerConfig);
            const existingSession = activeSessions.find(
                s => s.user && s.user.toLowerCase() === username.toLowerCase()
            );

            if (existingSession) {
                const existingMac = (existingSession.mac || '').toLowerCase().trim();
                const currentMac  = (mac || '').toLowerCase().trim();

                if (existingMac && currentMac && existingMac !== currentMac) {
                    // Beda perangkat -> Blokir & tampilkan peringatan
                    return res.status(409).json({
                        success: false,
                        error_code: 'session_active',
                        message: `Akun ini sedang digunakan oleh perangkat lain (${existingSession.address}). Silakan coba beberapa saat lagi atau hubungi administrator.`,
                        active_ip: existingSession.address,
                        uptime: existingSession.uptime,
                    });
                } else {
                    // Perangkat sama (stale session karena IP ganti/reconnect) -> Tendang sesi lama, lanjutkan login baru
                    console.log(`[AuthController] Menendang sesi usang untuk MAC yang sama: ${currentMac || existingMac}`);
                    await mikrotik.removeHotspotActive(routerConfig, existingSession.id);
                }
            }
        } catch (sessionCheckErr) {
            // Jika tidak bisa cek sesi (router mati/timeout), lanjutkan saja
            console.warn('[AuthController] Gagal cek sesi aktif, melanjutkan login:', sessionCheckErr.message);
        }

        // 5. Konfigurasi semua parameter user ke Mikrotik dalam SATU koneksi saja (efisien & bebas timeout)
        const cleanUsername = username.toLowerCase().trim();
        await mikrotik.setupPortalUser(
            routerConfig,
            cleanUsername,
            password,
            ip || null,
            mac || null,
            user.bandwidth_limit,
            user.website_block
        );

        // 6. Bersihkan sesi DB lama (jika ada sisa) dan log sesi aktif baru ke DB
        await query(
            `UPDATE active_sessions SET logout_at = NOW()
             WHERE hotspot_user_id = $1 AND logout_at IS NULL`,
            [user.id]
        );
        await query(
            `INSERT INTO active_sessions (hotspot_user_id, router_id, ip_address, mac_address)
             VALUES ($1, $2, $3, $4)`,
            [user.id, routerConfig.id, ip || null, mac || null]
        );

        res.json({
            success: true,
            message: 'Autentikasi berhasil.',
            data: {
                username:        user.username,
                full_name:       user.full_name,
                bandwidth_limit: user.bandwidth_limit,
                website_block:   user.website_block,
                router_ip:       routerConfig.ip_address,
                // URL Mikrotik hotspot login untuk redirect frontend
                mikrotik_login_url: `http://${routerConfig.ip_address}/login`,
            }
        });

    } catch (err) {
        console.error('[AuthController] portalLogin error:', err.message);
        if (err.message.includes('Mikrotik API Error')) {
            return res.status(503).json({ success: false, message: `Gagal terhubung ke router: ${err.message}` });
        }
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * POST /api/portal/logout
 * Logout user: hapus sesi, queue, dan entry dari address-list
 */
const portalLogout = async (req, res) => {
    const { username, ip, router_id } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username wajib diisi.' });
    }

    try {
        const rResult = await query('SELECT * FROM routers WHERE id = $1 AND is_active = TRUE', [router_id]);
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        const routerConfig = rResult.rows[0];

        // Hapus dari hotspot user list Mikrotik
        await mikrotik.removeHotspotUser(routerConfig, username);

        // Hapus Simple Queue
        await mikrotik.removeSimpleQueue(routerConfig, username);

        // Hapus dari address list jika ada
        if (ip) await mikrotik.removeUserFromBlockList(routerConfig, ip);

        // Update log sesi di DB
        await query(
            `UPDATE active_sessions SET logout_at = NOW()
             WHERE hotspot_user_id = (SELECT id FROM hotspot_users WHERE username = $1)
             AND logout_at IS NULL`,
            [username]
        );

        res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err) {
        console.error('[AuthController] portalLogout error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { portalLogin, portalLogout };
