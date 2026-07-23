# =============================================================================
#       MIKROTIK L2TP/IPSEC VPN CLIENT SETUP SCRIPT (mikrotik_vpn_setup.rsc)
# =============================================================================
# Jalankan script ini di Mikrotik untuk menghubungkan router ke VPS via L2TP/IPsec.
# Sesuaikan IP Public VPS, User, Password, dan IPsec Secret sebelum mengimpor.
# =============================================================================
/interface l2tp-client add \
    name=l2tp-to-vps \
    connect-to=103.67.244.193 \
    user=vpnuser \
    password=Hi7ZD6mhgBwVkxhi \
    use-ipsec=yes \
    ipsec-secret=ATE7GEM3frnPqjhhDpMc \
    profile=default-encryption \
    allow=mschap2 \
    disabled=no

/ip address print where interface=l2tp-to-vps

# Izinkan IP API Server (Backend VPS) mengakses API Mikrotik
/ip service
set api port=8728 address=0.0.0.0/0 disabled=no

:log info "Konfigurasi L2TP Client ke VPS telah ditambahkan."
