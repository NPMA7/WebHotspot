const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * POST /api/admin/login
 * Login admin dan dapatkan JWT token
 */
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    try {
        const result = await query(
            'SELECT * FROM admin_users WHERE username = $1 AND is_active = TRUE',
            [username.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const admin = result.rows[0];
        const isValid = await bcrypt.compare(password, admin.password_hash);

        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, full_name: admin.full_name },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: 'Login berhasil.',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name,
                email: admin.email,
            }
        });
    } catch (err) {
        console.error('[AdminController] login error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * GET /api/admin/profile
 * Ambil data profile admin yang sedang login
 */
const getProfile = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, username, full_name, email, created_at FROM admin_users WHERE id = $1',
            [req.admin.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * PUT /api/admin/change-password
 */
const changePassword = async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi.' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }
    try {
        const result = await query('SELECT * FROM admin_users WHERE id = $1', [req.admin.id]);
        const admin = result.rows[0];
        const isValid = await bcrypt.compare(current_password, admin.password_hash);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Password lama tidak sesuai.' });
        }
        const hash = await bcrypt.hash(new_password, 12);
        await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.admin.id]);
        res.json({ success: true, message: 'Password berhasil diubah.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { login, getProfile, changePassword };
