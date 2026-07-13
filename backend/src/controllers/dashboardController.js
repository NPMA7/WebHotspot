const { query }   = require('../config/db');
const mikrotik    = require('../services/mikrotikService');

/**
 * GET /api/dashboard/:routerId/stats
 * Ambil semua data dashboard: sistem info + resource + clock
 */
const getDashboardStats = async (req, res) => {
    try {
        const rResult = await query(
            'SELECT * FROM routers WHERE id = $1 AND is_active = TRUE',
            [req.params.routerId]
        );
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }
        const router = rResult.rows[0];

        const data = await mikrotik.getDashboardData(router);

        // Update last_seen
        await query('UPDATE routers SET last_seen = NOW() WHERE id = $1', [router.id]);

        res.json({ success: true, data: { ...data, router_name: router.name, router_id: router.id } });
    } catch (err) {
        console.error('[DashboardController] getDashboardStats:', err.message);
        res.status(503).json({
            success: false,
            message: `Gagal mengambil data router: ${err.message}`
        });
    }
};

/**
 * GET /api/dashboard/:routerId/sessions
 * Ambil daftar active session hotspot
 */
const getActiveSessions = async (req, res) => {
    try {
        const rResult = await query(
            'SELECT * FROM routers WHERE id = $1 AND is_active = TRUE',
            [req.params.routerId]
        );
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }

        const sessions = await mikrotik.getActiveHotspotUsers(rResult.rows[0]);

        // Enrich dengan data dari DB
        const enriched = await Promise.all(sessions.map(async (s) => {
            const userResult = await query(
                'SELECT bandwidth_limit, website_block, full_name FROM hotspot_users WHERE username = $1',
                [s.user]
            );
            const dbUser = userResult.rows[0];
            return {
                ...s,
                bandwidth_limit: dbUser?.bandwidth_limit || 'N/A',
                website_block:   dbUser?.website_block   || '',
                full_name:       dbUser?.full_name       || s.user,
            };
        }));

        res.json({ success: true, data: enriched, count: enriched.length });
    } catch (err) {
        console.error('[DashboardController] getActiveSessions:', err.message);
        res.status(503).json({
            success: false,
            message: `Gagal mengambil sesi aktif: ${err.message}`
        });
    }
};

/**
 * GET /api/dashboard/summary
 * Ringkasan global: total router, total user, user aktif
 */
const getSummary = async (req, res) => {
    try {
        const routerCount  = await query('SELECT COUNT(*) FROM routers WHERE is_active = TRUE');
        const userCount    = await query('SELECT COUNT(*) FROM hotspot_users WHERE is_active = TRUE');
        const blockedCount = await query("SELECT COUNT(*) FROM hotspot_users WHERE website_block IS NOT NULL AND website_block <> ''");
        const sessionCount = await query('SELECT COUNT(*) FROM active_sessions WHERE logout_at IS NULL');

        res.json({
            success: true,
            data: {
                total_routers:      parseInt(routerCount.rows[0].count),
                total_users:        parseInt(userCount.rows[0].count),
                blocked_users:      parseInt(blockedCount.rows[0].count),
                active_sessions_db: parseInt(sessionCount.rows[0].count),
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan.' });
    }
};

module.exports = { getDashboardStats, getActiveSessions, getSummary };
