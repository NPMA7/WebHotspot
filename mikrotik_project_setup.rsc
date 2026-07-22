# =============================================================================
#           MIKROTIK WEBHOTSPOT INTEGRATION SCRIPT (mikrotik_project_setup.rsc)
# =============================================================================
# Bagian ini berisi konfigurasi Captive Portal Hotspot, hak akses API untuk
# backend web admin, bypass Walled Garden, filter rules, serta script pembersih.
# =============================================================================

# --- LANGKAH 10: IP Service API port 8728 (Akses Web Admin Backend) ---
# CATATAN: Jika menggunakan VPN VPS, ubah 'address=192.168.88.0/24' menjadi subnet VPN Anda (contoh: address=10.8.0.0/24).
/ip service
set api port=8728 address=192.168.88.0/24 disabled=no
set www disabled=no
set winbox disabled=no
set ssh disabled=no
set api-ssl disabled=yes
set telnet disabled=yes
set ftp disabled=yes

# --- LANGKAH 11: Hotspot User Profile ---

/ip hotspot user profile
set default idle-timeout=00:02:00 keepalive-timeout=00:02:00 shared-users=1

# --- LANGKAH 12: Hotspot Server Profile ---

/ip hotspot profile
add name=hsprof-captive hotspot-address=192.168.10.1 login-by=http-pap html-directory=hotspot http-cookie-lifetime=3d split-user-domain=no use-radius=no

# --- LANGKAH 13: Hotspot Server pada bridge-hotspot ---

/ip hotspot
add name=hotspot1 interface=bridge-hotspot address-pool=none profile=hsprof-captive idle-timeout=00:02:00 keepalive-timeout=00:02:00 disabled=no

# --- LANGKAH 14: Walled Garden akses ke server captive portal backend ---
# CATATAN: Jika menggunakan VPS, ubah IP '192.168.88.2' di bawah menjadi IP Public VPS atau domain portal Anda (contoh: dst-host=portal-wifi.com).
/ip hotspot walled-garden
add server=hotspot1 dst-host=192.168.88.2

/ip hotspot walled-garden ip
add server=hotspot1 dst-address=192.168.88.2

# --- LANGKAH 15: Firewall Rules Dasar Hotspot ---

/ip firewall filter
add chain=input action=accept connection-state=established,related
add chain=forward action=accept connection-state=established,related
add chain=input action=drop connection-state=invalid
add chain=forward action=drop connection-state=invalid
add chain=input action=accept protocol=icmp
# CATATAN: Jika menggunakan VPN VPS, ubah 'src-address=192.168.88.0/24' menjadi subnet VPN Anda (contoh: src-address=10.8.0.0/24).
add chain=input action=accept src-address=192.168.88.0/24
add chain=input action=accept in-interface=bridge-hotspot protocol=udp dst-port=53
add chain=input action=accept in-interface=bridge-hotspot protocol=tcp dst-port=53
add chain=input action=accept in-interface=bridge-hotspot protocol=udp dst-port=67
add chain=input action=drop in-interface=ether1

# --- LANGKAH 16: Script Penghancur Sesi & Lease Diskonek Instan (Wireless) ---

/system script
add name=destroy-inactive-sessions source=":foreach activeSession in=[/ip hotspot active find] do={\r\n    :local mac [/ip hotspot active get \$activeSession mac-address];\r\n    :local username [/ip hotspot active get \$activeSession user];\r\n    :if (\$mac != \"\") do={\r\n        :if ([:len [/interface wireless registration-table find mac-address=\$mac]] = 0) do={\r\n            /ip hotspot active remove \$activeSession;\r\n            /ip dhcp-server lease remove [find mac-address=\$mac dynamic=yes];\r\n            /ip hotspot host remove [find mac-address=\$mac];\r\n            :local userFind [/ip hotspot user find name=\$username];\r\n            :if ([:len \$userFind] > 0) do={\r\n                :local comment [/ip hotspot user get \$userFind comment];\r\n                :if (\$comment~\"temp-\") do={\r\n                    /ip hotspot user remove \$userFind;\r\n                    /queue simple remove [find name=(\"hotspot-\" . \$username)];\r\n                }\r\n            }\r\n            :log info (\"Instantly destroyed active session, lease, host, and local user for disconnected MAC: \" . \$mac);\r\n        }\r\n    }\r\n}\r\n:foreach hostEntry in=[/ip hotspot host find where authorized=no bypassed=no] do={\r\n    :local mac [/ip hotspot host get \$hostEntry mac-address];\r\n    :if (\$mac != \"\") do={\r\n        :if ([:len [/interface wireless registration-table find mac-address=\$mac]] = 0) do={\r\n            /ip hotspot host remove \$hostEntry;\r\n            /ip dhcp-server lease remove [find mac-address=\$mac dynamic=yes];\r\n            :log info (\"Instantly destroyed unauthorized host and lease for disconnected MAC: \" . \$mac);\r\n        }\r\n    }\r\n}"

/system scheduler
add name=run-destroy-inactive-sessions interval=2s on-event=destroy-inactive-sessions

# --- LANGKAH 17: Backup Final ---

/system backup save name=hotspot-setup-backup
