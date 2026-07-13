const { RouterOSAPI } = require('node-routeros');
const { query } = require('./config/db');

async function main() {
    try {
        const r = (await query('SELECT * FROM routers LIMIT 1')).rows[0];
        const conn = new RouterOSAPI({
            host: r.ip_address,
            user: r.api_username,
            password: r.api_password,
            timeout: 10
        });

        await conn.connect();
        console.log('Monitoring Mikrotik Users started...');

        let lastUsers = [];

        // Poll every 200ms
        setInterval(async () => {
            try {
                const users = await conn.write('/ip/hotspot/user/print');
                const cleanUsers = users.map(u => ({
                    id: u['.id'],
                    name: u.name,
                    password: u.password,
                    comment: u.comment
                }));

                // Compare to last seen users
                const added = cleanUsers.filter(u => !lastUsers.some(l => l.id === u.id));
                const removed = lastUsers.filter(l => !cleanUsers.some(u => u.id === l.id));
                const changed = cleanUsers.filter(u => {
                    const match = lastUsers.find(l => l.id === u.id);
                    return match && (match.name !== u.name || match.password !== u.password || match.comment !== u.comment);
                });

                for (const u of added) {
                    console.log(`[ADD] User: ${u.name}, Pass: ${u.password}, Comment: ${u.comment}`);
                }
                for (const u of removed) {
                    console.log(`[REMOVE] User: ${u.name}`);
                }
                for (const u of changed) {
                    const prev = lastUsers.find(l => l.id === u.id);
                    console.log(`[CHANGE] User: ${u.name}, Pass: ${prev.password} -> ${u.password}, Comment: ${prev.comment} -> ${u.comment}`);
                }

                lastUsers = cleanUsers;
            } catch (err) {
                console.error('Poll error:', err.message);
            }
        }, 200);

    } catch (err) {
        console.error('Fatal error:', err.message);
    }
}

main();
