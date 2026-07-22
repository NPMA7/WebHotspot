# Panduan Setup L2TP/IPsec VPN Server (VPS Debian) 🖥️🔒

Dokumen ini menjelaskan langkah-langkah untuk menyiapkan **L2TP/IPsec VPN Server** pada VPS (Debian/Ubuntu) menggunakan script otomatis `xl2tpd` + `strongswan`.

---

## 🚀 1. Jalankan Script Installer L2TP/IPsec

Di terminal VPS Anda (sebagai user `root`), jalankan perintah berikut untuk mengunduh dan mengeksekusi installer otomatis:

```bash
wget https://git.io/vpnsetup -O vpnsetup.sh && sudo sh vpnsetup.sh
```

> [!NOTE]
> Alternatifnya, Anda dapat menggunakan script `vpnsetup.sh` yang sudah tersedia di repositori ini pada folder [VPN-SERVER/vpnsetup.sh](./VPN-SERVER/vpnsetup.sh).

---

## 🔑 2. Catat Kredensial VPN Default

Setelah proses instalasi selesai, terminal akan menampilkan kredensial VPN bawaan:

```text
========================================================
IPsec PSK : IPSec_Secret_Anda
Username  : vpnuser
Password  : vpnpassword
========================================================
```

> [!IMPORTANT]
> Catat **IPsec PSK (Pre-Shared Key)**, **Username**, dan **Password** ini untuk dikonfigurasikan pada Mikrotik Client.

---

## ⚙️ 3. Atur Kredensial Sendiri (Opsional)

Jika Anda ingin mengganti username/password atau IPsec Secret bawaan:

### A. Mengubah Username & Password VPN
Buka file otentikasi PPP di VPS:

```bash
sudo nano /etc/ppp/chap-secrets
```

Tambahkan akun Mikrotik baru di paling bawah file:
```text
# Username       Server     Password                  IP Address
"mikrotik"       *          "password_rahasia_anda"   *
```

### B. Mengubah IPsec Secret (Pre-Shared Key)
Buka file rahasia IPsec di VPS:

```bash
sudo nano /etc/ipsec.secrets
```

Sesuaikan kunci rahasia IPsec:
```text
%any %any : PSK "IPSec_Secret_Anda"
```

### C. Restart Layanan VPN
Terapkan perubahan dengan merestart service:

```bash
sudo service ipsec restart
sudo service xl2tpd restart
```

---

## 🔗 Langkah Selanjutnya (Mikrotik Client Setup)

Untuk mengonfigurasi router Mikrotik agar terhubung ke VPN Server VPS ini, silakan gunakan file script Mikrotik:
👉 **[mikrotik_vpn_setup.rsc](./mikrotik_vpn_setup.rsc)** atau baca panduan di **[SETUP.md](./SETUP.md)**.