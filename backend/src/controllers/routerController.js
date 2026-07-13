const { query }   = require('../config/db');
const mikrotik    = require('../services/mikrotikService');

// ─── GET /api/routers ────────────────────────────────────────────────────────
const getRouters = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, name, ip_address, api_port, api_username, location, is_active, last_seen, created_at
             FROM routers ORDER BY id ASC`
        );
        // Hitung jumlah user per router
        for (const r of result.rows) {
            const cnt = await query('SELECT COUNT(*) FROM hotspot_users WHERE router_id = $1', [r.id]);
            r.user_count = parseInt(cnt.rows[0].count);
        }
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[RouterController] getRouters:', err.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil data router.' });
    }
};

// ─── GET /api/routers/:id ────────────────────────────────────────────────────
const getRouterById = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, name, ip_address, api_port, api_username, location, is_active, last_seen, created_at FROM routers WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data router.' });
    }
};

// ─── POST /api/routers ───────────────────────────────────────────────────────
const createRouter = async (req, res) => {
    const { name, ip_address, api_port, api_username, api_password, location } = req.body;

    if (!name || !ip_address || !api_username) {
        return res.status(400).json({ success: false, message: 'Name, IP, dan username API wajib diisi.' });
    }

    try {
        const result = await query(
            `INSERT INTO routers (name, ip_address, api_port, api_username, api_password, location)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, ip_address, api_port, api_username, location, is_active`,
            [name, ip_address, api_port || 8728, api_username, api_password || '', location || null]
        );
        res.status(201).json({ success: true, message: 'Router berhasil ditambahkan.', data: result.rows[0] });
    } catch (err) {
        console.error('[RouterController] createRouter:', err.message);
        res.status(500).json({ success: false, message: 'Gagal menambahkan router.' });
    }
};

// ─── PUT /api/routers/:id ────────────────────────────────────────────────────
const updateRouter = async (req, res) => {
    const { name, ip_address, api_port, api_username, api_password, location, is_active } = req.body;

    try {
        const result = await query(
            `UPDATE routers SET
                name         = COALESCE($1, name),
                ip_address   = COALESCE($2, ip_address),
                api_port     = COALESCE($3, api_port),
                api_username = COALESCE($4, api_username),
                api_password = COALESCE($5, api_password),
                location     = COALESCE($6, location),
                is_active    = COALESCE($7, is_active)
             WHERE id = $8 RETURNING id, name, ip_address, api_port, api_username, location, is_active`,
            [name, ip_address, api_port, api_username, api_password, location, is_active, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        res.json({ success: true, message: 'Router berhasil diupdate.', data: result.rows[0] });
    } catch (err) {
        console.error('[RouterController] updateRouter:', err.message);
        res.status(500).json({ success: false, message: 'Gagal mengupdate router.' });
    }
};

// ─── DELETE /api/routers/:id ─────────────────────────────────────────────────
const deleteRouter = async (req, res) => {
    try {
        const result = await query('DELETE FROM routers WHERE id = $1 RETURNING name', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        res.json({ success: true, message: `Router "${result.rows[0].name}" berhasil dihapus.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal menghapus router.' });
    }
};

// ─── GET /api/routers/:id/test ───────────────────────────────────────────────
const testConnection = async (req, res) => {
    try {
        const result = await query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        const router = result.rows[0];

        const testResult = await mikrotik.testConnection(router);

        // Update last_seen
        await query('UPDATE routers SET last_seen = NOW() WHERE id = $1', [req.params.id]);

        res.json({
            success: true,
            message: `Koneksi ke ${router.ip_address} berhasil!`,
            data: { identity: testResult.identity, last_seen: new Date().toISOString() }
        });
    } catch (err) {
        res.json({
            success: false,
            message: `Koneksi gagal: ${err.message}`,
            data: null
        });
    }
};

module.exports = { getRouters, getRouterById, createRouter, updateRouter, deleteRouter, testConnection };
