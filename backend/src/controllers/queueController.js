const { query } = require('../config/db');
const mikrotik = require('../services/mikrotikService');

/**
 * GET /api/queues/:routerId
 * Ambil daftar Simple Queues dari router MikroTik
 */
const getQueues = async (req, res) => {
    try {
        const rResult = await query(
            'SELECT * FROM routers WHERE id = $1 AND is_active = TRUE',
            [req.params.routerId]
        );
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }

        const queues = await mikrotik.getSimpleQueues(rResult.rows[0]);

        res.json({ success: true, data: queues, count: queues.length });
    } catch (err) {
        console.error('[QueueController] getQueues:', err.message);
        res.status(503).json({
            success: false,
            message: `Gagal mengambil daftar Queues: ${err.message}`
        });
    }
};

/**
 * POST /api/queues/:routerId/action
 * Eksekusi aksi pada Simple Queue (enable, disable, remove)
 */
const actionQueue = async (req, res) => {
    try {
        const { queue_id, action } = req.body;
        if (!queue_id || !action) {
            return res.status(400).json({ success: false, message: 'queue_id dan action wajib diisi.' });
        }

        const rResult = await query(
            'SELECT * FROM routers WHERE id = $1 AND is_active = TRUE',
            [req.params.routerId]
        );
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }

        const result = await mikrotik.manageSimpleQueue(rResult.rows[0], queue_id, action);
        res.json({ success: true, message: result.message });
    } catch (err) {
        console.error('[QueueController] actionQueue:', err.message);
        res.status(500).json({
            success: false,
            message: `Gagal memproses queue: ${err.message}`
        });
    }
};

module.exports = { getQueues, actionQueue };
