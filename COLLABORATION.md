# Panduan Kolaborasi: Developer & Network Engineer 🤝🌐

Dokumen ini berfungsi sebagai jembatan komunikasi teknis antara **Software Developer** (pembuat aplikasi web admin & API) dan **Network Engineer** (pengelola infrastruktur router Mikrotik) agar proyek integrasi captive portal ini berjalan lancar.

---

## 💻 1. Perspektif Software Developer

### 🔑 Data yang Dibutuhkan Developer dari Network Engineer:
1. **Kredensial Akses API Mikrotik**:
   * IP management router (contoh: `192.168.88.1`).
   * Port API RouterOS (default: `8728` atau `8729` untuk SSL).
   * Akun administrator khusus API dengan hak akses *read* dan *write*.
2. **Topologi IP & Nama Interface**:
   * Nama interface / bridge tempat hotspot dijalankan (contoh: `bridge-hotspot`).
   * IP Address range subnet hotspot (contoh: `192.168.10.0/24`).
3. **Format Limit Bandwidth (Simple Queue)**:
   * Penamaan Queue yang diinginkan agar tidak bentrok dengan setup jaringan kantor/sekolah lainnya.
4. **Target Domain Pemblokiran**:
   * Domain-domain spesifik beserta variannya yang ingin dimasukkan ke dalam fitur blokir web admin (contoh: YouTube, domain internal dinas, dsb).

### 🛠️ Apa yang Dilakukan Developer Terhadap Data Tersebut:
* **Konfigurasi Pool Koneksi API**: Developer memasukkan kredensial API Mikrotik ke tabel router di database PostgreSQL agar sistem Express.js dapat menginisiasi library `node-routeros`.
* **Parameterisasi Query API**: Developer menulis kode API untuk membuat, memperbarui, dan menghapus simple queue (`/queue/simple/add`) menggunakan variabel IP client dan bandwidth limit yang dikirim dari React frontend.
* **Otomatisasi Aturan Firewall**: Developer membuat loop dinamis di Node.js untuk mendaftarkan nama domain yang diblokir ke menu `/ip firewall address-list` dan memasang filter rule drop Lapis Ganda di Mikrotik secara real-time.

---

## 🌐 2. Perspektif Network Engineer

### 🔑 Data yang Dibutuhkan Network Engineer dari Developer:
1. **IP Address & Port Server Application**:
   * IP Address host server tempat Docker backend dan database Postgres dijalankan (contoh: `192.168.88.2`).
   * Port HTTP Server Portal Admin (contoh: `3000`).
2. **Kebutuhan Walled Garden**:
   * Domain dan alamat IP server backend yang harus dilewati (bypass) sebelum pengguna melakukan login (agar browser client dapat memuat halaman captive portal).
3. **Pola Penandaan User (Comments)**:
   * Format tanda pengenal (comment) yang diberikan backend saat membuat user hotspot sementara (contoh format: `temp-<timestamp>` atau `Block npma for <username>`). Ini penting agar script scheduler Mikrotik dapat membedakan mana user statis dan mana user dinamis buatan web.

### 🛠️ Apa yang Dilakukan Network Engineer Terhadap Data Tersebut:
* **Routing & NAT Setup**: Network Engineer mengatur tabel routing agar port 8728 Mikrotik terbuka dan aman (hanya dapat diakses oleh IP server Docker host `192.168.88.2`).
* **Walled Garden Bypass**: Mengonfigurasi `/ip hotspot walled-garden ip` agar IP server web admin (`192.168.88.2`) di-bypass dari captive portal redirection.
* **Implementasi Scheduler & Autocleanup (`mikrotik_project_setup.rsc`)**: 
  * Network Engineer memasang script dan scheduler yang memantau wireless registration-table.
  * Ketika client terputus sinyal, script akan membaca comment berawalan `temp-` yang dibuat developer, lalu menghapus active session hotspot, simple queue, dan lease DHCP yang bersangkutan dalam waktu 2 detik agar resource router tetap kosong dan bersih.

---

## 📋 3. Lembar Kerja Integrasi (Checklist Pertemuan)

Gunakan tabel ini untuk mencocokkan parameter sebelum melakukan deployment final:

| Parameter Integrasi | Nilai / Konfigurasi | Pemilik Data | Status |
| :--- | :--- | :--- | :--- |
| **IP Management Mikrotik** | `192.168.88.1` | Network Engineer | [ ] Cocok |
| **IP Docker Host Server** | `192.168.88.2` | Developer | [ ] Cocok |
| **Port API RouterOS** | `8728` | Network Engineer | [ ] Cocok |
| **SSID Wi-Fi Hotspot** | `HotSpot-WiFi` | Network Engineer | [ ] Cocok |
| **Format Queue Name** | `hotspot-<username>` | Developer | [ ] Cocok |
| **Format Comment User** | `temp-<timestamp>` | Developer | [ ] Cocok |
| **Target Bypass Portal** | `http://192.168.88.2:3000` | Developer | [ ] Cocok |
