# Alur Logika Jaringan & Aplikasi (Logic Flow) 🔄🧠

Dokumen ini menjelaskan alur kerja (workflow) bagaimana sistem **WebHotspot Manager** mengontrol jaringan Mikrotik Anda. Penjelasan di bawah ini dirancang dengan bahasa yang **mudah dipahami orang awam** (menggunakan analogi sehari-hari) sekaligus tetap mempertahankan **akurasi teknis** untuk kebutuhan developer.

## 🌐 1. Alur Autentikasi Captive Portal (Proses Client Login Internet)

> **Analogi Sederhana**: Seperti pintu gerbang bioskop. Saat Anda baru masuk (koneka Wi-Fi), Anda dihentikan oleh petugas (Mikrotik) untuk membeli tiket di loket (halaman login portal). Setelah Anda beli tiket dan divalidasi, barulah Anda diperbolehkan masuk studio (internet).

Berikut diagram urutan langkah pertukaran data antara perangkat client, router, portal web, dan database:

```mermaid
sequenceDiagram
    actor Client as HP / Laptop Client
    participant Mikrotik as Router Mikrotik
    participant Portal as Web Portal (React)
    participant Backend as Node.js Backend
    participant DB as Database PostgreSQL

    Client->>Mikrotik: 1. Koneksi ke Wi-Fi
    Mikrotik->>Client: 2. Berikan IP Address via DHCP
    Client->>Mikrotik: 3. Buka browser / akses website HTTP
    Note over Mikrotik: Blokir & alihkan akses karena belum login
    Mikrotik->>Client: 4. Redirect ke halaman internal router (192.168.10.1)
    Client->>Portal: 5. Diarahkan ke Web Portal eksternal (port 3000)
    Portal->>Client: 6. Tampilkan halaman Form Login
    Client->>Portal: 7. Masukkan Username & Password, klik Login
    Portal->>Backend: 8. Kirim data login ke Backend (HTTP POST /api/portal/login)
    Backend->>DB: 9. Cari & cocokkan data user di database
    DB-->>Backend: 10. Kembalikan data user valid
    Backend->>Mikrotik: 11. Buat akun hotspot temporer & limit bandwidth (API port 8728)
    Mikrotik-->>Backend: 12. Konfirmasi akun temporer sukses dibuat
    Backend-->>Portal: 13. Kirim data akun temporer ke portal
    Portal->>Mikrotik: 14. Submit form login tersembunyi ke router (HTTP POST)
    Note over Mikrotik: Verifikasi akun temporer sukses & tandai IP aktif
    Mikrotik->>Client: 15. Internet Terbuka! Client bebas browsing
```

### Penjelasan Rinci Langkah Demi Langkah (Untuk Orang Awam & Developer):

1. **Koneksi Jaringan Dasar (Langkah 1 & 2)**:
   * **Secara Teknis**: Perangkat client meminta sewa IP address (DHCP Request) ke router Mikrotik. Router membagikan IP dinamis (contoh: `192.168.10.254`) dan mencatat alamat hardware fisik (MAC Address: `9A:E6:77:1B:7C:0F`) pada tabel DHCP Leases.
   * **Bahasa Awam**: HP Anda menyapa Wi-Fi router, dan router memberikan "nomor rumah sementara" (IP Address) agar HP Anda bisa berkirim data di dalam jaringan tersebut.

2. **Pembajakan & Pengalihan Awal (Langkah 3, 4 & 5)**:
   * **Secara Teknis**: Ketika client mencoba membuka situs web non-HTTPS (port 80), aturan firewall NAT hotspot di Mikrotik membelokkan paket data tersebut dan merespon dengan header `HTTP 302 Redirect` ke halaman internal router (`http://192.168.10.1/login`). Di dalam memori router, berkas `redirect.html` langsung mengekstrak variabel dinamis Mikrotik (`$(ip)`, `$(mac)`, `$(link-login-only)`) dan mengalihkan browser client ke alamat Web Portal eksternal kita (`http://192.168.88.2:3000`) dengan menyertakan variabel tersebut sebagai parameter URL (Query String: `?ip=192.168.10.254&mac=9A:E6:77:1B:7C:0F&link-login-only=http://192.168.10.1/login`).
   * **Bahasa Awam**: Ketika Anda mencoba membuka Google, router menyadari Anda belum login. Router langsung memblokir jalan Anda dan otomatis memunculkan browser di HP Anda yang diarahkan langsung ke halaman loket web login kita, dengan membisikkan data IP dan MAC HP Anda ke halaman loket tersebut agar sistem tahu siapa Anda.

3. **Autentikasi Aplikasi (Langkah 6, 7, 8, 9 & 10)**:
   * **Secara Teknis**: Halaman React Web Portal membaca parameter URL dan menyimpannya di memori. Pengguna memasukkan username & password asli mereka. Portal mengirimkan data login beserta IP/MAC perangkat tersebut ke server Backend Express.js di port `3001` via HTTP POST (`/api/portal/login`) membawa JSON payload `{ username, password, ip, mac, linkLoginOnly }`. Backend kemudian melakukan kueri ke database PostgreSQL untuk memvalidasi apakah akun tersebut ada, aktif, dan tidak kedaluwarsa.
   * **Bahasa Awam**: Anda mengetik nama pengguna dan sandi Anda di halaman web loket. Halaman web tersebut mengirimkan nama Anda ke backend server untuk dicocokkan dengan buku catatan database. Jika nama Anda terdaftar dan berstatus aktif, server akan memberikan lampu hijau.

4. **Komunikasi API & Pembuatan Tiket Sementara (Langkah 11 & 12)**:
   * **Secara Teknis**: Begitu valid, backend menghasilkan password acak sekali pakai. Backend lalu melakukan koneksi API socket TCP (Port 8728) ke router Mikrotik menggunakan library `node-routeros`. Backend mengirim perintah `/ip/hotspot/user/add` untuk membuat user hotspot lokal temporer di router dengan comment `temp-<timestamp>` (agar nantinya bisa dihapus otomatis oleh scheduler router) dan parameter limit bandwidth sesuai dengan profil user tersebut di database.
   * **Bahasa Awam**: Setelah backend tahu Anda adalah user yang sah, backend langsung menelepon router Mikrotik melalui jalur khusus (API) dan berkata: *"Tolong buatkan tiket sementara bernama 'temp-xxx' khusus untuk HP ini, berikan kecepatan internet sesuai paketnya!"*. Mikrotik membuatkan tiket itu dan membalas *"Siap, tiket sudah dibuat!"*.

5. **Submit Akhir & Internet Terbuka (Langkah 13, 14 & 15)**:
   * **Secara Teknis**: Backend membalas request portal dengan status sukses beserta kredensial akun temporer. Browser client di halaman portal React menerima data sukses ini, lalu secara instan menjalankan kode Javascript untuk men-submit form HTTP POST tersembunyi (hidden form submit) secara langsung ke IP router Mikrotik (`http://192.168.10.1/login`) membawa data akun temporer. Router menerima data form login temporer tersebut, memverifikasinya cocok, dan menandai IP client tersebut di tabel `hotspot/active` sebagai authorized. Akses internet client langsung aktif.
   * **Bahasa Awam**: Web loket menerima tiket sementara dari backend. Browser HP Anda secara otomatis menyodorkan tiket sementara tersebut ke router Mikrotik di latar belakang (tanpa Anda sadari). Router melihat tiketnya cocok, langsung membuka palang pintu internet untuk HP Anda, dan Anda pun resmi terhubung ke internet!seketika.

---

## 👥 2. Alur Tambah & Edit User (Sinkronisasi Data Real-Time)

> **Analogi Sederhana**: Seperti memperbarui profil pelanggan di kasir. Begitu data pelanggan diubah di komputer kasir (web admin), server langsung mengirim pesan ke satpam di pintu masuk (router Mikrotik) untuk mengubah hak akses pelanggan tersebut secara instan.

```mermaid
graph TD
    A[Admin Web Portal] -->|1. Klik Simpan/Update User| B(React Frontend)
    B -->|2. Kirim Data Terbaru| C(Express Backend)
    C -->|3. Simpan ke PostgreSQL| D[(Database PostgreSQL)]
    C -->|4. Tanya Status Online User ke Mikrotik| E(Router Mikrotik)
    
    E -->|5. Kirim Info: User Sedang Aktif / Tidak| C
    
    C -->|6. Jika User Sedang Aktif: Update Limit Bandwidth & Filter Blokir| E
    C -->|7. Kirim Respon Berhasil ke UI| B
    B -->|8. Tampilkan Notifikasi Sukses| A
```

### Penjelasan Rinci untuk Orang Awam:
1. **Ubah Data**: Admin mengubah bandwidth limit (misal dari 2Mbps naik ke 10Mbps) atau mencentang blokir situs di web admin.
2. **Pengecekan Status Aktif**: Aplikasi backend tidak hanya menyimpan data tersebut ke dalam database PostgreSQL, tetapi juga langsung bertanya ke Mikrotik: *"Apakah user ini sekarang sedang online menggunakan internet?"*
3. **Eksekusi Real-time**: 
   * Jika user **sedang online**, backend langsung memerintahkan Mikrotik detik itu juga untuk memperbarui limit kecepatannya (Simple Queue) dan memperbarui daftar blokirnya. Kecepatan internet user langsung berubah saat itu juga tanpa perlu diskonek.
   * Jika user **sedang offline**, data hanya disimpan di database. Aturan baru tersebut baru akan dipasang di Mikrotik nanti saat user tersebut login kembali.

---

## 🛡️ 3. Alur Pemblokiran Situs Lapis Ganda Real-Time (NPMA & YouTube)

> **Analogi Sederhana**: Seperti menutup keran air pipa spesifik yang sedang mengalir. Dibanding mematikan seluruh pompa utama rumah (mendiskonek internet user), sistem kita secara cerdas hanya menutup keran pipa khusus (IP Address List Drop) yang mengalirkan air ke bak tertentu (NPMA/YouTube) sehingga air ke bak tersebut langsung mampet.

```mermaid
graph TD
    A[Admin Centang Blokir NPMA/YT] --> B(IP HP User dimasukkan ke daftar address-list blokir)
    B --> C{Bagaimanakah Status Koneksi User Saat Ini?}
    
    C -->|Koneksi Sedang Aktif / Established| D[Lapis 1: IP List Drop forward]
    D --> E[Aliran data ke web tersebut langsung macet & putus seketika]
    
    C -->|Membuka Halaman Baru / Koneksi Baru| F[Lapis 2: Layer 7 & TLS SNI Sniffing]
    F --> G[Handshake koneksi baru ditolak & dibuang]
    
    C -->|Mencoba Bypass via HTTP/3 QUIC| I[Aturan Tambahan: UDP 443 Drop]
    I --> J[Memaksa browser turun kelas ke TCP biasa]
    J --> F
    
    E --> H[HP User menampilkan tulisan: Connection Timed Out / Internet Mati]
    G --> H
```

### Penjelasan Rinci & Teknis (Kenapa Metode Ini Sangat Ampuh?):

Memblokir situs modern seperti YouTube sangat sulit karena mereka menggunakan **IP dinamis (banyak IP yang berubah-ubah)** dan **protokol HTTP/3 (QUIC)**. Jika hanya memakai satu metode, blokir akan mudah jebol. Sistem ini memadukan 3 lapis perlindungan:

#### 1. Lapis 1: Memutus Koneksi Aktif Berbasis IP Dinamis (`dst-address-list`)
* **Tantangannya**: YouTube memiliki ribuan IP address yang terus berubah setiap detiknya (CDN). Kita tidak mungkin menulis ribuan IP tersebut satu per satu secara manual.
* **Cara Kerja Teknis**: Mikrotik memiliki fitur *Dynamic DNS Resolving*. Saat kita menambahkan nama domain `youtube.com` ke `/ip firewall address-list` (`youtube-blocked`), router Mikrotik secara pintar bertindak seperti anjing pelacak yang terus-menerus memantau IP-IP baru milik YouTube di internet dan menyimpannya secara dinamis.
* **Eksekusi Real-time**: Ketika admin mengaktifkan blokir di web, IP HP user dimasukkan ke list `hotspot-blocked-youtube`. Aturan firewall drop langsung aktif. Karena firewall mendeteksi paket data berdasarkan IP tujuan (`youtube-blocked`), **koneksi yang sedang berjalan (established) akan langsung terpotong saat itu juga** tanpa menunggu browser di-refresh atau koneksi Wi-Fi diputus.

#### 2. Lapis 2: Menangkal Bypass DNS Berbasis Sensor Nama Situs (`Layer 7 & TLS SNI`)
* **Tantangannya**: Jika pengguna mengubah pengaturan DNS di HP mereka secara manual (misal memakai Secure DNS atau Google DNS `8.8.8.8`), IP YouTube yang diakses HP mereka tidak akan sempat terdeteksi oleh dynamic list router, sehingga blokir IP Lapis 1 bisa lolos.
* **Cara Kerja Teknis**: Di sinilah Lapis 2 bekerja. Ketika HP mencoba membuat sambungan baru ke website, browser wajib mengirimkan pesan jabat tangan pertama yang disebut **TLS Client Hello**. Pada pesan awal ini, nama website tujuan dikirim secara polos (tidak dienkripsi) di dalam parameter bernama **SNI (Server Name Indication)**.
* **Eksekusi Real-time**: Firewall Mikrotik menggunakan mesin pencari pola teks (`layer7-protocol`) untuk "menguping" pesan jabat tangan awal tersebut. Begitu terdeteksi teks bertuliskan `youtube`, `googlevideo`, atau `npma.my.id`, router akan langsung membuang paket tersebut sebelum koneksi internet sempat tersambung.

#### 3. Lapis Tambahan: Menutup Celah Bypass QUIC Protokol (UDP Port 443)
* **Tantangannya**: Browser modern seperti Google Chrome dan HP Android sering menggunakan teknologi **HTTP/3 (QUIC)** yang berjalan di atas protokol UDP port 443. Protokol ini tidak menggunakan jabat tangan TLS standar, sehingga bisa lolos dari sensor L7 biasa.
* **Cara Kerja Teknis**: Sistem memasang filter khusus yang memblokir semua lalu lintas UDP port 443 (`protocol=udp dst-port=443`) bagi perangkat user yang sedang diblokir.
* **Eksekusi Real-time**: Karena port UDP 443 diblokir, browser HP client akan otomatis menyerah dan melakukan *fallback* (turun kelas) menggunakan protokol TCP standar (port 443 TCP). Begitu browser turun kelas ke TCP, koneksi mereka otomatis masuk perangkap sensor Lapis 1 dan Lapis 2 kita, membuat pemblokiran menjadi 100% rapat tanpa celah!

---

## 🔌 4. Alur Pembersih Sesi Otomatis (Autocleanup Jaringan)

> **Analogi Sederhana**: Seperti sensor lampu otomatis di toilet mall. Jika sensor mendeteksi sudah tidak ada orang di dalam ruangan (perangkat client sudah keluar dari area jangkauan Wi-Fi router), sistem akan otomatis mematikan lampu dan menyiram toilet (menghapus sewa IP, host, dan queue) agar hemat energi dan tempat bersih kembali.

```mermaid
flowchart TD
    A[Mulai Scheduler / Timer 2 Detik] --> B[/Tarik daftar user aktif di Mikrotik/]
    B --> C{Apakah sinyal fisik MAC HP client masih terdaftar di router?}
    
    C -->|Ya: HP Masih Dapat Sinyal Wi-Fi| D[Abaikan, Biarkan Client Tetap Online]
    
    C -->|Tidak: HP Sudah Diluar Jangkauan Sinyal| E[Hapus Sesi Aktif Hotspot]
    E --> F[Hapus Sewa Alamat IP DHCP dynamic client]
    F --> G[Hapus Sesi Tabel Host Hotspot]
    
    G --> H{Apakah akun user ini memiliki comment 'temp-'?}
    H -->|Ya: Akun ini buatan otomatis backend| I[Hapus Akun Hotspot lokal]
    I --> J[Hapus Simple Queue limit kecepatan user]
    H -->|Tidak: Akun statis buatan manual| K[Selesai]
    
    J --> K
    K --> L[Log: Router Bersih dari IP & Sesi Tersangkut]
```

### Penjelasan Rinci untuk Orang Awam:
1. **Sinyal Wi-Fi Hilang**: Ketika pengguna pergi meninggalkan area jangkauan Wi-Fi (misalnya pulang ke rumah), HP mereka secara fisik terputus dari antena router.
2. **Pembersihan Cepat**: Scheduler pintar di dalam Mikrotik yang berjalan setiap **2 detik** akan menyadari hilangnya sinyal HP tersebut.
3. **Mencegah IP Tersangkut (Ghost Lease)**: Script langsung menghapus sewa IP (DHCP Lease) dan tabel host HP tersebut dari memori router. Ini mencegah bug klasik Mikrotik di mana IP client tersangkut sehingga orang lain tidak bisa masuk.
4. **Penghapusan Akun Sampah**: Jika akun tersebut berjenis sementara (memiliki tanda `temp-`), script juga akan menghapus akun login dan simple queue-nya agar Winbox Anda tetap bersih, rapi, dan kapasitas CPU router tidak terbebani oleh sampah rule yang menumpuk.
