const { RouterOSAPI } = require('node-routeros');

const r = {
    ip_address: '192.168.88.1',
    api_port: 8728,
    api_username: 'admin',
    api_password: 'admin',
};

const conn = new RouterOSAPI({
    host:     r.ip_address,
    port:     r.api_port,
    user:     r.api_username,
    password: r.api_password,
    timeout:  10
});

async function main() {
    try {
        await conn.connect();
        console.log('Connected!');

        const username = 'user_normal';
        const password = 'user123';

        // 1. Cek / Hapus user jika ada
        const existing = await conn.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (existing && existing.length > 0) {
            await conn.write('/ip/hotspot/user/remove', [`=.id=${existing[0]['.id']}`]);
            console.log('Removed old user');
        }

        // 2. Tambah user baru
        await conn.write('/ip/hotspot/user/add', [
            `=name=${username}`,
            `=password=${password}`,
            `=profile=default`,
            `=comment=temp-${Date.now()}`
        ]);
        console.log('Added user');

        // 3. Print user yang baru dibuat secara detail
        const users = await conn.write('/ip/hotspot/user/print', [`?name=${username}`]);
        console.log('Created User Details:', users[0]);

        await conn.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
