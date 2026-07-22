# Panduan Setup & Instalasi 💻⚙️

Dokumen ini menjelaskan langkah-langkah untuk menyiapkan, menginstal, dan menghubungkan seluruh ekosistem **WebHotspot Manager** dari awal hingga berjalan penuh.

---

## 📋 Prasyarat Jaringan & Server
Sebelum memulai setup, pastikan Anda memiliki:
1. **Server / Host PC**: OS Windows/Linux yang memiliki **Docker** dan **Docker Compose** terpasang.
2. **Router Mikrotik**: RouterOS v6 atau v7 dengan port API aktif (default port `8728`).
3. **Koneksi Jaringan**: Server / Host PC harus berada dalam satu jaringan yang dapat melakukan ping ke IP Mikrotik (`192.168.88.1` atau IP management router Anda).

---

## 🛠️ Langkah 1: Setup Jaringan & Konfigurasi Mikrotik
Kita akan menggunakan dua file script konfigurasi otomatis terpisah yang sudah disiapkan:
* **`mikrotik_basic_setup.rsc`**: Konfigurasi dasar internet, IP address, DHCP server, NAT, dan DNS.
* **`mikrotik_project_setup.rsc`**: Konfigurasi Hotspot server, Walled Garden bypass, akses API port, dan script pembersih otomatis.

1. Buka Winbox dan hubungkan ke router Mikrotik Anda.
2. Buka menu **Files** di Winbox.
3. Drag & drop berkas **`mikrotik_basic_setup.rsc`** dan **`mikrotik_project_setup.rsc`** dari komputer Anda ke jendela Files Winbox.
4. Buka **New Terminal** di Winbox, lalu jalankan konfigurasi dasar terlebih dahulu:
   ```routeros
   /import file-name=mikrotik_basic_setup.rsc
   ```
5. Setelah sukses, jalankan script integrasi captive portal web:
   ```routeros
   /import file-name=mikrotik_project_setup.rsc
   ```
6. Tunggu proses impor selesai. Router Anda sekarang telah dikonfigurasi dengan jaringan dasar internet LAN beserta integrasi captive portal dan API backend.

---

## 📦 Langkah 2: Setup Database & Backend (Docker Compose)
Backend kita berjalan di dalam container Docker untuk memudahkan deployment database PostgreSQL dan runtime Node.js.

1. Buka terminal (Powershell/Bash) di direktori root proyek (`d:\WebHotspot`).
2. Jalankan perintah berikut untuk mendownload image database, menyiapkan struktur database awal (`database/init.sql`), dan menjalankan backend:
   ```bash
   docker-compose up -d --build
   ```
3. Periksa status container yang sedang berjalan menggunakan perintah:
   ```bash
   docker-compose ps
   ```
   Pastikan container `hotspot_db` dan `hotspot_backend` berstatus **Up (Running)**.

---

## 🎨 Langkah 3: Setup Web Admin Frontend
Frontend admin dibuat menggunakan React dengan Vite.

1. Buka terminal baru dan masuk ke direktori frontend admin:
   ```bash
   cd d:\WebHotspot\frontend
   ```
2. Instal semua dependensi Node package:
   ```bash
   npm install
   ```
3. Jalankan development server lokal:
   ```bash
   npm run dev
   ```
4. Buka browser Anda dan akses halaman admin di URL:
   ```text
   http://localhost:3000
   ```
   *(Gunakan username dan password default admin yang terdaftar di database untuk login).*

---

## 🌐 Langkah 4: Hubungkan Web Admin ke Router Mikrotik
1. Login ke halaman Web Admin (`http://localhost:3000`).
2. Masuk ke menu **Router Setup** atau **Setting**.
3. Daftarkan router utama Anda dengan mengisi data berikut:
   * **Nama Router**: Router-Utama
   * **IP Address**: IP router Anda (contoh: `192.168.88.1`)
   * **API Port**: `8728`
   * **Username**: Username API Mikrotik (default: `admin`)
   * **Password**: Password API Mikrotik Anda
4. Klik **Simpan** dan pastikan status koneksi router berubah menjadi **Connected** (berwarna hijau).

---

## 🔑 Langkah 5: Pasang Halaman Login Captive Portal (Hotspot Files)
File captive portal lokal harus diunggah ke memori internal router Mikrotik agar ditampilkan saat user tersambung ke Wi-Fi.

1. Buka direktori proyek `/flash/hotspot`.
2. Drag & drop seluruh isi folder `hotspot` tersebut ke direktori utama (biasanya folder bernama `flash/hotspot` atau direktori root `hotspot`) pada menu **Files** Winbox router Mikrotik Anda.
3. Di Winbox, masuk ke **IP -> Hotspot -> Server Profiles**.
4. Double click profile hotspot Anda (contoh: `hsprof-captive`), pastikan pada kolom **HTML Directory** sudah terarah ke folder hotspot yang baru Anda unggah tadi.
5. Klik Apply dan OK.

Selesai! Sekarang sistem siap digunakan sepenuhnya.

---

## 🔒 Integrasi Multi-Router & VPN VPS (Opsional)
Jika Anda ingin menghubungkan beberapa router Mikrotik di lokasi berbeda ke satu VPS portal terpusat:

### 1. Arsitektur Jaringan (Hub-and-Spoke VPN)
* **VPS Backend** bertindak sebagai **VPN Server** (misal menggunakan WireGuard dengan IP VPN `10.8.0.1`).
* **Setiap Mikrotik** bertindak sebagai **VPN Client** yang tersambung ke IP Public VPS dan masing-masing mendapatkan IP VPN unik (misal `10.8.0.2`, `10.8.0.3`, dst).
* **Client WiFi** mengakses portal melalui IP Public/Domain VPS Anda.

### 2. Penyesuaian Konfigurasi Mikrotik
Pada file `mikrotik_project_setup.rsc`, sesuaikan variabel berikut di bagian atas berkas sebelum mengimpor:
```routeros
:local PortalServerIP "IP_PUBLIC_VPS_ANDA"
:local VpnSubnet "10.8.0.0/24"
```
* Ini akan otomatis membuka akses API port `8728` hanya untuk jalur VPN (`10.8.0.0/24`) demi keamanan.

### 3. Penyesuaian File Captive Portal (`login.html` & `rlogin.html`)
Karena HP/Laptop client berada di luar jaringan VPN, browser client harus diarahkan ke IP Public VPS atau Domain VPS Anda.
* Buka `/flash/hotspot/login.html` dan `/flash/hotspot/rlogin.html`.
* Ganti URL `http://192.168.88.2:3000/` dengan alamat IP Public VPS atau domain portal Anda, misalnya `http://portal-wifi.my.id/`.
* Upload kembali folder `hotspot` tersebut ke files Mikrotik.

