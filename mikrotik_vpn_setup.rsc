# =============================================================================
#       MIKROTIK L2TP/IPSEC VPN CLIENT SETUP SCRIPT (mikrotik_vpn_setup.rsc)
# =============================================================================
# Jalankan script ini di Mikrotik untuk menghubungkan router ke VPS via L2TP/IPsec.
# Sesuaikan IP Public VPS, User, Password, dan IPsec Secret sebelum mengimpor.
# =============================================================================

/interface l2tp-client
add name=l2tp-to-vps \
    connect-to=IP_PUBLIC_VPS \
    user=mikrotik \
    password=password_rahasia_anda \
    use-ipsec=yes \
    ipsec-secret=IPSec_Secret_Anda \
    profile=default-encryption \
    disabled=no

# Izinkan IP API Server (Backend VPS) mengakses API Mikrotik
/ip service
set api port=8728 address=0.0.0.0/0 disabled=no

:log info "Konfigurasi L2TP Client ke VPS telah ditambahkan."
