const { query } = require('./config/db');
require('./services/mikrotikService');
const { RouterOSAPI } = require('node-routeros');

async function main() {
    try {
        const r = (await query('SELECT * FROM routers LIMIT 1')).rows[0];
        const conn = new RouterOSAPI({ host: r.ip_address, user: r.api_username, password: r.api_password });
        conn.on('error', () => {});
        await conn.connect();
        
        // 1. Hapus script/scheduler lama
        try {
            const scheds = await conn.write('/system/scheduler/print', ['?name=run-destroy-inactive-sessions']);
            if (scheds.length > 0) {
                await conn.write('/system/scheduler/remove', ['=.id=' + scheds[0]['.id']]);
            }
        } catch (_) {}
        try {
            const scripts = await conn.write('/system/script/print', ['?name=destroy-inactive-sessions']);
            if (scripts.length > 0) {
                await conn.write('/system/script/remove', ['=.id=' + scripts[0]['.id']]);
            }
        } catch (_) {}

        // 2. Tambahkan script baru yang menyertakan penghapusan user hotspot lokal secara instan
        console.log('Registering updated destroy-inactive-sessions script with local user cleanup...');
        const scriptSource = 
            ':foreach activeSession in=[/ip hotspot active find] do={\r\n' +
            '    :local mac [/ip hotspot active get $activeSession mac-address];\r\n' +
            '    :local username [/ip hotspot active get $activeSession user];\r\n' +
            '    :if ($mac != "") do={\r\n' +
            '        :if ([:len [/interface wireless registration-table find mac-address=$mac]] = 0) do={\r\n' +
            '            /ip hotspot active remove $activeSession;\r\n' +
            '            /ip dhcp-server lease remove [find mac-address=$mac dynamic=yes];\r\n' +
            '            /ip hotspot host remove [find mac-address=$mac];\r\n' +
            '            :local userFind [/ip hotspot user find name=$username];\r\n' +
            '            :if ([:len $userFind] > 0) do={\r\n' +
            '                :local comment [/ip hotspot user get $userFind comment];\r\n' +
            '                :if ($comment~"temp-") do={\r\n' +
            '                    /ip hotspot user remove $userFind;\r\n' +
            '                    /queue simple remove [find name=("hotspot-" . $username)];\r\n' +
            '                }\r\n' +
            '            }\r\n' +
            '            :log info ("Instantly destroyed active session, lease, host, and local user for disconnected MAC: " . $mac);\r\n' +
            '        }\r\n' +
            '    }\r\n' +
            '}\r\n' +
            ':foreach hostEntry in=[/ip hotspot host find where authorized=no bypassed=no] do={\r\n' +
            '    :local mac [/ip hotspot host get $hostEntry mac-address];\r\n' +
            '    :if ($mac != "") do={\r\n' +
            '        :if ([:len [/interface wireless registration-table find mac-address=$mac]] = 0) do={\r\n' +
            '            /ip hotspot host remove $hostEntry;\r\n' +
            '            /ip dhcp-server lease remove [find mac-address=$mac dynamic=yes];\r\n' +
            '            :log info ("Instantly destroyed unauthorized host and lease for disconnected MAC: " . $mac);\r\n' +
            '        }\r\n' +
            '    }\r\n' +
            '}';

        await conn.write('/system/script/add', [
            '=name=destroy-inactive-sessions',
            '=source=' + scriptSource
        ]);

        // 3. Tambahkan scheduler interval 2s
        console.log('Adding run-destroy-inactive-sessions scheduler...');
        await conn.write('/system/scheduler/add', [
            '=name=run-destroy-inactive-sessions',
            '=interval=2s',
            '=on-event=destroy-inactive-sessions'
        ]);

        console.log('Successfully set up instant active session, lease, and user destroy script!');
        await conn.close();
    } catch (err) {
        console.error('Setup script error:', err.message);
    }
}

main();
