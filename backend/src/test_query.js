const { query } = require('./config/db');

async function test() {
    const macLower = '9a:e6:77:1b:7c:0f';
    const dbRes = await query(`
        SELECT u.username 
        FROM active_sessions s 
        JOIN hotspot_users u ON s.hotspot_user_id = u.id 
        WHERE LOWER(s.mac_address) = LOWER($1)
        ORDER BY s.login_at DESC 
        LIMIT 1
    `, [macLower]);
    console.log('Result:', dbRes.rows);
}

test();
