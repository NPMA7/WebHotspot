# Panduan Penggunaan & Tutorial Web Admin 📖💡

Dokumen ini menjelaskan cara menggunakan fitur-fitur pada **WebHotspot Manager** untuk memantau jaringan, mengelola pengguna, membatasi kecepatan, serta melakukan pemblokiran situs secara real-time.

---

## 📊 1. Memantau Jaringan Melalui Dashboard
Saat pertama kali masuk ke Web Admin, Anda akan disajikan statistik jaringan secara real-time:
* **Total Users**: Jumlah seluruh akun pengguna hotspot terdaftar di database.
* **Active Sessions**: Jumlah perangkat pengguna yang saat ini sedang login aktif menggunakan Wi-Fi hotspot.
* **DHCP Leases**: Total IP address yang saat ini disewa oleh perangkat client.
* **Status Router**: Menampilkan uptime, pemakaian CPU, dan memori RAM router Mikrotik Anda.

---

## 👥 2. Manajemen Pengguna Hotspot (Add, Edit, & Delete)
Semua akun hotspot dikelola di menu **Pengguna Hotspot**:

* **Menambah User**: Klik tombol **+ Tambah User**, isi username, password, nama lengkap, limit bandwidth, dan pilih router. Akun akan tersimpan di database web dan otomatis dibuatkan akun hotspot-nya di Winbox.
* **Mengedit User**: Klik icon edit (✏️) pada baris nama user untuk mengubah password, limit bandwidth, atau status aktif.
* **Menghapus User**: Klik icon tempat sampah (🗑️) merah. Sistem akan otomatis menghapus akun di database sekaligus membersihkan data akun hotspot tersebut dari Mikrotik.

---

## 🚀 3. Membatasi Kecepatan Internet (Bandwidth Limit)
Anda bisa mengatur batas kecepatan download dan upload user secara fleksibel:
1. Pada form tambah/edit user, buka pilihan **Bandwidth Limit**.
2. Pilih preset limit kecepatan yang tersedia (contoh: `1M/1M`, `5M/5M`, `10M/10M`) atau ketik manual (format: `upload/download`, contoh: `512k/2M`).
3. Klik **Update**.
4. Di latar belakang, backend akan secara instan menghapus queue lama dan membuat Simple Queue baru (`hotspot-<username>`) di Mikrotik dengan limit target IP user tersebut secara real-time.

---

## 🛡️ 4. Pemblokiran Situs secara Real-time (NPMA & YouTube)
Anda dapat melarang user tertentu untuk mengakses website tertentu (NPMA, YouTube, dll) tanpa mengganggu lalu lintas internet mereka yang lain:

1. Buka form edit user, cari bagian **Blokir Akses Situs**.
2. Centang website yang ingin diblokir (contoh: `npma.my.id` atau `youtube.com`).
3. Klik **Update**.
4. **Hasil Instan (Tanpa Putus Sinyal)**:
   * Backend mendaftarkan IP perangkat user tersebut ke firewall address-list khusus di Mikrotik (`hotspot-blocked-npma` atau `hotspot-blocked-youtube`).
   * Rule drop established IP dan Layer 7 filter akan aktif seketika.
   * Koneksi aktif (browsing/streaming) milik user tersebut untuk website yang diblokir langsung macet dan terputus di HP mereka secara real-time.
5. **Membuka Blokir (Unblock)**:
   * Hilangkan centang pada website tersebut, lalu klik **Update**.
   * IP perangkat user dihapus dari list. Akses internet ke website tersebut langsung normal kembali saat itu juga.
   * **Auto Cleanup**: Jika sudah tidak ada lagi user lain yang diblokir pada website tersebut, backend akan otomatis menghapus rules firewall drop L7/IP/QUIC beserta string regexp L7 di Mikrotik agar Winbox Anda tetap bersih dari rule sampah.

---

## 🔌 5. Mengelola Sesi Aktif & Memutuskan Koneksi (Kick)
Pada menu **Sesi Aktif Hotspot**, Anda bisa memantau siapa saja perangkat yang sedang online:
* Anda dapat melihat IP Address, MAC Address, Uptime, serta total trafik data download/upload masing-masing user.
* **Fitur Kick (Putus Sesi)**: Jika Anda ingin memutuskan koneksi pengguna secara paksa, klik tombol **Kick** di sebelah nama user. Sistem akan memunculkan modal konfirmasi bertema gelap premium. Setelah disetujui, sesi aktif user tersebut langsung terhapus dari router.

---

## 📑 6. DHCP Leases & Pembersih IP Hantu
Pada menu **DHCP Leases**, Anda dapat melihat daftar sewa IP address pada jaringan hotspot:
* Tabel ini secara otomatis menyaring baris sewa IP yang kosong (tanpa IP/MAC) agar data di web admin bersih dan akurat.
* **Hapus DHCP Lease**: Jika ada IP tersangkut, klik tombol **Hapus Lease** untuk melepaskan sewa IP tersebut dari router.
* **Wireless Autocleanup (Script di Mikrotik)**: Scheduler router secara otomatis mendeteksi jika client terputus sinyal Wi-Fi secara fisik (misal client pulang ke rumah/menjauh dari router). Scheduler akan otomatis membersihkan active session, host table, dan DHCP lease client tersebut secara instan dalam 2 detik sehingga tidak ada data hantu (stale sessions) tersisa di router.
