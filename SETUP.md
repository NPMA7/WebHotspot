# Panduan Setup & Instalasi 💻⚙️

Dokumen ini menjelaskan alur instalasi **WebHotspot Manager** dari awal hingga sistem berjalan penuh, baik untuk skenario **Lokal (LAN)** maupun **Online (VPS)**.

---

## 📋 Ringkasan File Script Mikrotik

Proyek ini menyediakan 3 berkas script Mikrotik (`.rsc`) yang dijalankan sesuai kebutuhan:

| File Script                                                    | Fungsi                                                                       | Kapan Diimpor?            |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------ |
| **[mikrotik_basic_setup.rsc](./mikrotik_basic_setup.rsc)**     | Konfigurasi dasar ISP, IP Address, DHCP Server, NAT, dan DNS.                | **Wajib** (Awal)          |
| **[mikrotik_project_setup.rsc](./mikrotik_project_setup.rsc)** | Konfigurasi Hotspot Server, API Port `8728`, Walled Garden, dan Autocleanup. | **Wajib** (Setelah Basic) |
| **[mikrotik_vpn_setup.rsc](./mikrotik_vpn_setup.rsc)**         | Konfigurasi L2TP/IPsec Client untuk menghubungkan Mikrotik ke VPS.           | **Khusus VPS**            |

---

## 🛠️ Langkah 1: Konfigurasi Router Mikrotik

1. Buka **Winbox** dan hubungkan ke router Mikrotik Anda.
2. Buka menu **Files** di Winbox, lalu drag & drop berkas script berikut:
   - `mikrotik_basic_setup.rsc`
   - `mikrotik_project_setup.rsc`
   - `mikrotik_vpn_setup.rsc` _(Hanya jika deploy di VPS)_
3. Buka **New Terminal** di Winbox dan jalankan secara berurutan:

   ```routeros
   # 1. Setup dasar jaringan internet & LAN
   /import file-name=mikrotik_basic_setup.rsc

   # 2. Setup captive portal hotspot & API
   /import file-name=mikrotik_project_setup.rsc
   ```

4. **Khusus Skenario VPS / Remote Router**:
   Jika server WebHotspot Anda berada di VPS, jalankan script VPN Client:
   ```routeros
   /import file-name=mikrotik_vpn_setup.rsc
   ```
   _(Pastikan data IP Public VPS, Username, Password, dan IPsec Secret di dalam file tersebut sudah disesuaikan)._

---

## 📦 Langkah 2: Jalankan Application Server (Docker Compose)

Di komputer Server / VPS (yang sudah terpasang Docker & Docker Compose):

1. Buka terminal di direktori root proyek `WebHotspot`.
2. Jalankan perintah untuk mengaktifkan Database PostgreSQL, Backend, dan Frontend Nginx:
   ```bash
   docker-compose up -d --build
   ```
3. Pastikan seluruh container berstatus **Up (Running)**:
   ```bash
   docker-compose ps
   ```

---

## 🌐 Langkah 3: Hubungkan Web Admin ke Router Mikrotik

1. Buka browser Anda dan akses halaman admin di:
   - **Lokal**: `http://localhost:3000` (atau IP PC Server `http://192.168.88.2:3000`)
   - **VPS**: `http://IP_PUBLIC_VPS:3000` (atau domain Anda)
2. Login ke Web Admin, lalu masuk ke menu **Setting / Router Setup**.
3. Daftarkan Router Anda:
   - **Skenario Lokal**: Isikan IP Address Mikrotik `192.168.88.1` dan API Port `8728`.
   - **Skenario VPS**: Isikan IP VPN Mikrotik (misal `10.8.0.2` atau `192.168.42.2`) dan API Port `8728`.
4. Simpan data router dan pastikan indikator status koneksi menunjukkan **Connected (Hijau)**.

---

## 🔑 Langkah 4: Upload Halaman Login Captive Portal (Hotspot Files)

1. Buka folder proyek [flash/hotspot](./flash/hotspot).
2. **Catatan Skenario VPS**:
   Jika deploy di VPS, buka file `login.html` dan `rlogin.html`, lalu ganti URL `http://192.168.88.2:3000/` dengan IP Public VPS / Domain Anda (contoh: `http://portal-wifi.my.id/`).
3. Drag & drop seluruh isi folder `flash/hotspot` ke menu **Files** Winbox router Mikrotik Anda (folder `flash/hotspot` atau `hotspot`).
4. Di Winbox, buka **IP -> Hotspot -> Server Profiles**:
   - Double-click `hsprof-captive`, pastikan **HTML Directory** sudah terarah ke folder `hotspot`.
   - Klik **Apply** & **OK**.

---

## 🔒 Panduan Lanjutan: Setup VPN Server di VPS

Jika Anda baru pertama kali menyiapkan VPS Debian/Ubuntu untuk VPN L2TP/IPsec, silakan baca dokumentasi khusus:
👉 **[Panduan Setup VPS & L2TP VPN (VPNSETUP.md)](./VPNSETUP.md)**
