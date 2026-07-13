require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Global Error Handlers to prevent crashes from node-routeros ──
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// ── Security Middleware ──────────────────────────────────────
app.set('trust proxy', 1); // For express-rate-limit behind reverse proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── General Middleware ───────────────────────────────────────
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 500,
    message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' }
});

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 menit
    max: 20,
    message: { success: false, message: 'Terlalu banyak percobaan login.' }
});

app.use('/api/', apiLimiter);
app.use('/api/portal/login', loginLimiter);
app.use('/api/admin/login', loginLimiter);

// ── Routes ───────────────────────────────────────────────────
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/portal',    require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/routers',   require('./routes/routers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/dhcp',      require('./routes/dhcp'));
app.use('/api/hotspot-router', require('./routes/hotspotRouter'));

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Hotspot Backend is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// ── Background Cleanup Task ──────────────────────────────────
const { query } = require('./config/db');
const mikrotik = require('./services/mikrotikService');

setInterval(async () => {
    try {
        const routersResult = await query('SELECT * FROM routers WHERE is_active = true');
        for (const router of routersResult.rows) {
            // Jalankan getActiveHotspotUsers yang otomatis melakukan pembersihan
            await mikrotik.getActiveHotspotUsers(router).catch(() => {});
        }
    } catch (err) {
        // Abaikan error berkala
    }
}, 15000);

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Hotspot Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
});
