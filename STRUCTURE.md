# Panduan Struktur Direktori & File Proyek 📂📁

Dokumen ini menjelaskan struktur folder secara komprehensif beserta fungsi detail dari **setiap berkas** di dalam proyek **WebHotspot Manager**.

---

## 🌳 Pohon Direktori Lengkap (Detailed Directory Tree)

```text
WebHotspot/
│
├── backend/                              # REST API & Komunikasi Jaringan (Node.js)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                     # Inisialisasi PostgreSQL Connection Pool
│   │   ├── controllers/
│   │   │   ├── adminController.js        # CRUD Admin Web Portal
│   │   │   ├── authController.js         # JWT Token Login Admin & Portal Client
│   │   │   ├── dashboardController.js    # Pengolah Statistik Dashboard (Stats, RAM, CPU)
│   │   │   ├── dhcpController.js         # Pengelola IP DHCP Leases Mikrotik
│   │   │   ├── hotspotRouterController.js# Pengendali Integrasi Portal Sesi Client
│   │   │   ├── routerController.js       # CRUD Data Router Mikrotik
│   │   │   └── userController.js         # CRUD User Hotspot, Bandwidth, & Import CSV
│   │   ├── middleware/
│   │   │   └── adminAuth.js              # Verifikasi Token JWT Admin
│   │   ├── routes/
│   │   │   ├── admin.js                  # Endpoint Rute Admin
│   │   │   ├── auth.js                   # Endpoint Rute Autentikasi
│   │   │   ├── dashboard.js              # Endpoint Rute Dashboard
│   │   │   ├── dhcp.js                   # Endpoint Rute DHCP Leases
│   │   │   ├── hotspotRouter.js          # Endpoint Portal Client Login
│   │   │   ├── routers.js                # Endpoint Rute Pengaturan Router
│   │   │   └── users.js                  # Endpoint Rute User Hotspot
│   │   ├── services/
│   │   │   └── mikrotikService.js        # Core API Integrasi RouterOS Mikrotik
│   │   ├── utils/
│   │   │   └── csvImport.js              # Parser & Validator Berkas CSV
│   │   ├── index.js                      # Entry Point & Express Server Bootstrap
│   │   ├── monitor_users.js              # Script Background Monitor Status Client
│   │   ├── setup_destroy_script.js       # Script Pemasang Autocleanup pada Mikrotik
│   │   ├── test_login.js                 # Script Test Login API Mikrotik
│   │   └── test_query.js                 # Script Test Query Database PostgreSQL
│   ├── Dockerfile                        # Konfigurasi Docker Image Backend Node.js
│   └── package.json                      # Berkas Dependensi & Script Node.js
│
├── database/                             # Skema Basis Data
│   └── init.sql                          # Skema Struktur Tabel PostgreSQL & Akun Default
│
├── flash/hotspot/                        # Berkas Captive Portal Mikrotik (Unggah ke Router)
│   ├── login.html                        # Halaman Utama Login Captive Portal
│   ├── alogin.html                       # Halaman Konfirmasi Sukses Login
│   ├── status.html                       # Halaman Pemantau Sisa Uptime & Kuota
│   ├── logout.html                       # Halaman Konfirmasi Keluar Jaringan
│   ├── error.html                        # Halaman Informasi Kesalahan Sistem
│   ├── radvert.html                      # Halaman Iklan / Pengumuman Hotspot
│   ├── redirect.html                     # Halaman Redirect Otomatis ke Login
│   └── rlogin.html                       # Halaman Redirect Login Cadangan
│
├── frontend/                             # Aplikasi Web Admin (React & Vite)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js                 # Wrapper HTTP Request Fetch API & Auth Token
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Layout.jsx            # Layout Wrapper Navigasi Utama
│   │   │   │   └── Sidebar.jsx           # Panel Samping (Menu Dashboard, Users, dll)
│   │   │   └── ui/
│   │   │       ├── Modal.jsx             # Komponen Dialog Box Pop-up Gelap
│   │   │       ├── Toast.jsx             # Komponen Banner Notifikasi Melayang
│   │   │       └── index.jsx             # Loader & Badge Shared Components
│   │   ├── hooks/
│   │   │   ├── ToastContext.js           # Context Provider Global Toast Notification
│   │   │   └── useToast.js               # Hook Akses Instan Toast Notification
│   │   ├── pages/
│   │   │   ├── Portal/
│   │   │   │   └── Login.jsx             # Halaman Login Portal Client (HP/Laptop)
│   │   │   ├── Dashboard.jsx             # Halaman Utama Grafik Statistik Real-Time
│   │   │   ├── DhcpLeases.jsx            # Halaman Pengelola Sewa IP Jaringan
│   │   │   ├── Hotspot.jsx               # Halaman Monitor Sesi Aktif & Tombol Kick
│   │   │   ├── Login.jsx                 # Halaman Login Portal Admin Web
│   │   │   ├── Routers.jsx               # Halaman Pendaftaran API Router Mikrotik
│   │   │   └── Users.jsx                 # Halaman Manajemen User, Bandwidth, & Import CSV
│   │   ├── App.css                       # Reset CSS Dasar Layout React
│   │   ├── App.jsx                       # Router Peta Lokasi Halaman Web React
│   │   ├── index.css                     # Gaya CSS Utama Glassmorphism Dark Mode
│   │   └── main.jsx                      # Entry Point Bootstrap React JS
│   └── package.json                      # Berkas Dependensi & Script React Vite
│
├── nginx/                                # Web Server Reverse Proxy
│   └── nginx.conf                        # Konfigurasi Reverse Proxy Nginx
│
├── VPN-SERVER/                           # Script Otomasi VPN Server
│   └── vpnsetup.sh                       # Script Installer L2TP/IPsec Server di VPS Debian
│
├── .env                                  # Konfigurasi Variabel Lingkungan Sistem
├── docker-compose.yml                    # Konfigurasi Orkestrasi Container Docker
├── mikrotik_basic_setup.rsc              # Script Setup Internet & LAN Dasar Router
├── mikrotik_project_setup.rsc            # Script Setup Hotspot & Integrasi API Web
├── mikrotik_vpn_setup.rsc                # Script Setup L2TP/IPsec Client di Router Mikrotik
├── sample_users.csv                      # Templat Format Berkas CSV Impor Massal
├── README.md                             # Panduan Instalasi Sistem Lengkap
├── SETUP.md                              # Panduan Setup Lengkap: Web UI, Hotspot, & VPN
├── STRUCTURE.md                          # Panduan Struktur Direktori Proyek
├── TUTORIAL.md                           # Panduan Lengkap: Web UI, Hotspot, & VPN
└── VPNSETUP.md                           # Panduan Setup L2TP/IPsec VPN Server & Client
```

---

## 📝 Deskripsi Fungsi Setiap Berkas Secara Detail

### 1. Modul Backend (`/backend`)
BackendExpress bertindak sebagai penghubung logika antara database, web UI admin, dan router OS Mikrotik.

#### `src/config/db.js`
Inisiasi koneksi pool menuju database PostgreSQL. Dikonfigurasi dengan pool maksimum 20 koneksi dan timeout otomatis untuk menjaga integritas memori server.

#### `src/controllers/`
* **`adminController.js`**: Menangani pembuatan akun admin baru, pembaruan password admin, dan verifikasi session admin.
* **`authController.js`**: Menghasilkan token JWT saat login berhasil di halaman portal admin maupun portal client hotspot.
* **`dashboardController.js`**: Menarik data resource server database dan mengirim request monitoring CPU/RAM/Uptime ke Mikrotik untuk ditampilkan di grafik dashboard.
* **`dhcpController.js`**: Menghubungi API Mikrotik untuk menampilkan list sewa IP dan mengirim perintah hapus sewa IP (release lease).
* **`hotspotRouterController.js`**: Mengurus alur autentikasi client hotspot di Captive Portal saat melakukan login PAP.
* **`routerController.js`**: Menyimpan dan memvalidasi konfigurasi IP, port API, user, dan password Mikrotik di database.
* **`userController.js`**: Mengendalikan data user (hotspot_users) PostgreSQL, sinkronisasi realtime limit bandwidth/Simple Queue ke Mikrotik, dan endpoint untuk import massal CSV.

#### `src/middleware/adminAuth.js`
Intercept request Express untuk mengekstrak dan memverifikasi token JWT pada HTTP header Authorization. Memblokir akses rute jika token tidak valid.

#### `src/routes/`
Memetakan URL endpoint API ke controller yang sesuai (contoh: `/api/users` diarahkan ke `userController.js`).

#### `src/services/mikrotikService.js`
* **File Paling Krusial**: Mengatur koneksi socket TCP RouterOS API menggunakan library `node-routeros`.
* Memuat seluruh fungsi operasional router: `setupPortalUser`, `clearConnectionsForIp`, `getDhcpLeases`, `removeDhcpLease`, dll.
* Di dalamnya terintegrasi algoritma **Lapis Ganda (L7 + IP established drop)** untuk memblokir domain secara dinamis dan instan.

#### `src/utils/csvImport.js`
Melakukan sanitasi baris file CSV, memilah delimiter koma, memvalidasi format regex limit bandwidth (misal: `10M/10M`), dan menghasilkan array objek user yang bersih untuk database.

#### `src/index.js`
Bootstrap server Express, mendaftarkan semua routes, mengaktifkan cors, body parser JSON, dan menyalakan port backend di `3001`.

#### `src/monitor_users.js`
Script daemon yang secara berkala memeriksa database PostgreSQL untuk memastikan keakuratan status keaktifan user.

#### `src/setup_destroy_script.js`
Script helper sekali jalan (one-time execution) yang menyuntikkan script pembersih sesi otomatis (`destroy-inactive-sessions`) dan scheduler-nya ke dalam sistem RouterOS Mikrotik via API.

---

### 2. Modul Database (`/database`)
#### `init.sql`
Menyiapkan skema database relational:
* `routers`: menyimpan IP, port, dan kredensial API Mikrotik.
* `hotspot_users`: menyimpan data client, password, limit bandwidth, dan status blokir.
* `admins`: menyimpan username dan password hashed admin portal.
* Menyisipkan satu akun admin default saat instalasi pertama kali.

---

### 3. Modul Captive Portal (`/flash/hotspot`)
Berkas HTML, CSS, dan JS murni yang dipasang di disk internal router Mikrotik.
* **`login.html`**: Antarmuka halaman masuk Wi-Fi. Menggunakan skema HTTP-PAP untuk mengirim data login ke server backend secara aman.
* **`alogin.html`**: Halaman pengalihan sukses yang menginformasikan kepada pengguna bahwa koneksi internet telah aktif.
* **`status.html`**: Jendela kecil popup yang menampilkan durasi tersambung (uptime) dan sisa kecepatan kuota data.
* **`logout.html`**: Halaman pemutus koneksi hotspot secara bersih.
* **`redirect.html`**: File redirection instan yang membajak browser client dan mengarahkannya secara otomatis ke domain web portal login kita.

---

### 4. Modul Frontend (`/frontend`)
Single Page Application (SPA) React yang berjalan di sisi browser admin.

#### `src/api/client.js`
Wrapper `fetch` yang secara otomatis menyisipkan token JWT `hotspot_token` dari localStorage pada header HTTP request, menangani error authorization (401), dan mendukung pengiriman berkas `FormData` secara native untuk kebutuhan upload CSV.

#### `src/components/layout/`
* **`Layout.jsx`**: Menyusun kerangka utama dashboard admin (header atas dan integrasi panel navigasi).
* **`Sidebar.jsx`**: Navigasi perpindahan halaman web admin (Dashboard, Pengguna Hotspot, Sesi Aktif, DHCP Leases, Router Setup, dll).

#### `src/components/ui/`
* **`Modal.jsx`**: Box konfirmasi bertema gelap transparan (misal konfirmasi saat Kick user atau Hapus lease).
* **`Toast.jsx`**: Animasi pop-up melayang di sudut layar untuk memberi feedback operasi sukses/gagal secara responsif.

#### `src/pages/`
* **`Dashboard.jsx`**: Render visual charts pemakaian resource RAM/CPU router, chart histori uptime, dan kartu statistik data counter.
* **`DhcpLeases.jsx`**: Render tabel sewa IP dan menyaring lease-lease kosong. Memiliki tombol hapus lease.
* **`Hotspot.jsx`**: List live sessions hotspot di Mikrotik secara real-time lengkap dengan counter data download/upload dan tombol Kick.
* **`Login.jsx`**: Halaman login portal administrator dengan visual field password.
* **`Routers.jsx`**: Form setup koneksi API router Mikrotik dengan fungsi check test koneksi realtime.
* **`Users.jsx`**: Halaman utama tempat admin menambah, mengedit, menghapus, mengubah limit bandwidth, mencentang blokir situs user, serta tombol Import CSV.

#### `src/index.css`
Pusat styling CSS global. Mengadopsi prinsip desain **Sleek Dark Glassmorphism** (warna latar belakang gelap pekat, efek translusi kaca buram menggunakan `backdrop-filter`, warna tombol aksen ungu neon, teks kontras tinggi, typography modern, serta micro-animations transisi).
