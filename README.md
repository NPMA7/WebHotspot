# WebHotspot Manager 🌐🚀

Sistem manajemen terintegrasi untuk Mikrotik Hotspot dengan Captive Portal premium, manajemen bandwidth, dan pemblokiran situs lapis ganda secara real-time.

Aplikasi ini memadukan kemudahan pengelolaan database berbasis web modern (React & Node.js) dengan eksekusi aturan jaringan RouterOS secara presisi menggunakan koneksi API yang efisien dan andal.

---

## 🛠️ Tech Stack & Arsitektur

### 1. Backend (`/backend`)
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: PostgreSQL (menyimpan data user, log autentikasi, & konfigurasi router)
* **Mikrotik API Connection**: `node-routeros` (dikonfigurasi dengan Connection Pooling untuk mencegah overhead koneksi TCP berulang kali)

### 2. Frontend (`/frontend`)
* **Framework**: React.js dengan Vite
* **Styling**: Vanilla CSS dengan desain Glassmorphism bertema gelap premium, modern, dan sepenuhnya responsif.
* **Fitur**: Grafik real-time dashboard, kelola user hotspot, live sessions monitoring, hapus lease DHCP, form konfigurasi router.

### 3. Captive Portal (`/flash/hotspot`)
* **Struktur**: HTML & JavaScript vanilla untuk kompatibilitas penuh dengan browser HP model lama/baru.
* **Login Mode**: HTTP-PAP (mengirim data login ke backend internal portal secara aman).

---

## 🛡️ Fitur Jaringan Utama

### 1. Pemblokiran Lapis Ganda Real-time (Dual-Layer Block)
Untuk memblokir situs-situs CDN modern seperti YouTube atau domain kustom (NPMA), sistem ini menerapkan penggabungan metode:
* **Lapis IP (Established Drop)**: IP target didaftarkan pada `/ip firewall address-list` Mikrotik untuk proses dynamic resolving otomatis. Aturan drop forward disetel di index teratas (`place-before=0`). Ini memutus **seluruh koneksi aktif (established)** seketika tanpa perlu memutus koneksi internet user.
* **Lapis L7 (New Connection Drop)**: Deteksi regex string di tab `/ip firewall layer7-protocol` untuk mencegah bypass koneksi baru via DNS pihak ketiga/Secure DNS.
* **QUIC Protocol Drop**: Memblokir lalu lintas port UDP 443 untuk mencegah bypass browser modern (Chrome/HTTP3).

### 2. Penanganan DHCP Lease Ghosting & Cleanup Otomatis
* Backend secara cerdas menyaring data sampah (lease kosong) pada menu DHCP Leases.
* Script pembersih otomatis berjalan setiap 2 detik di dalam router Mikrotik untuk menghapus sesi hotspot, host, dan sewa IP yang tersisa jika perangkat client terputus secara fisik (Wireless Registration Table kosong).
* Ketika status blokir untuk suatu situs dimatikan (uncheck) di web admin, sistem mendeteksi apakah masih ada user lain yang diblokir. Jika list kosong, backend otomatis menghapus **seluruh rule filter L7/IP/QUIC, address-list target, dan regex L7** dari router secara real-time agar konfigurasi Winbox tetap bersih.

---

## 📂 Dokumentasi Lainnya

Untuk memulai deploy dan menggunakan sistem ini, silakan baca dokumentasi detail berikut:

1. 💻 **[Panduan Instalasi & Konfigurasi (SETUP.md)](file:///d:/WebHotspot/SETUP.md)**
2. 📖 **[Panduan Penggunaan Fitur Web Admin (TUTORIAL.md)](file:///d:/WebHotspot/TUTORIAL.md)**
3. 🤝 **[Panduan Kolaborasi Tim Dev & Network (COLLABORATION.md)](file:///d:/WebHotspot/COLLABORATION.md)**
4. 📂 **[Panduan Struktur Folder & File (STRUCTURE.md)](file:///d:/WebHotspot/STRUCTURE.md)**
5. 🔄 **[Panduan Alur Logika Jaringan & Aplikasi (LOGIC_FLOW.md)](file:///d:/WebHotspot/LOGIC_FLOW.md)**
