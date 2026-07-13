const { query } = require('../config/db');
const mikrotik = require('../services/mikrotikService');

const getLeases = async (req, res) => {
    const { router_id } = req.query;
    if (!router_id) {
        return res.status(400).json({ success: false, message: 'router_id wajib diisi.' });
    }

    try {
        const rResult = await query('SELECT * FROM routers WHERE id = $1', [router_id]);
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }

        const leases = await mikrotik.getDhcpLeases(rResult.rows[0]);
        res.json({ success: true, data: leases });
    } catch (err) {
        console.error('[DHCPController] getLeases:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Gagal mengambil DHCP leases.' });
    }
};

const deleteLease = async (req, res) => {
    const { id } = req.params;
    const { router_id } = req.query;
    if (!router_id) {
        return res.status(400).json({ success: false, message: 'router_id wajib diisi.' });
    }

    try {
        const rResult = await query('SELECT * FROM routers WHERE id = $1', [router_id]);
        if (rResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Router tidak ditemukan.' });
        }

        await mikrotik.removeDhcpLease(rResult.rows[0], id);
        res.json({ success: true, message: 'DHCP lease berhasil dihapus.' });
    } catch (err) {
        console.error('[DHCPController] deleteLease:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Gagal menghapus DHCP lease.' });
    }
};

module.exports = {
    getLeases,
    deleteLease,
};
