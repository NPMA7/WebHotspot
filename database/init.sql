-- ============================================================
-- Mikrotik Captive Portal - Database Schema
-- PostgreSQL Init Script
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: admin_users
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: routers
-- Menyimpan konfigurasi Mikrotik yang dikelola
-- ============================================================
CREATE TABLE IF NOT EXISTS routers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    api_port INTEGER DEFAULT 8728,
    api_username VARCHAR(100) NOT NULL,
    api_password VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: hotspot_users
-- Menyimpan data user hotspot (master data di DB, bukan di Mikrotik)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotspot_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    email VARCHAR(100),
    phone VARCHAR(30),
    bandwidth_limit VARCHAR(50) DEFAULT '10M/10M',   -- format: download/upload, e.g. 10M/10M
    website_block VARCHAR(255) DEFAULT '',            -- situs terblokir (comma-separated, e.g. 'npma,youtube')
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_hotspot_users_username ON hotspot_users(username);
CREATE INDEX IF NOT EXISTS idx_hotspot_users_router_id ON hotspot_users(router_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_users_active ON hotspot_users(is_active);

-- ============================================================
-- TABLE: active_sessions
-- Log sesi aktif user
-- ============================================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    hotspot_user_id INTEGER REFERENCES hotspot_users(id) ON DELETE CASCADE,
    router_id INTEGER REFERENCES routers(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    login_at TIMESTAMPTZ DEFAULT NOW(),
    logout_at TIMESTAMPTZ,
    bytes_in BIGINT DEFAULT 0,
    bytes_out BIGINT DEFAULT 0,
    session_token UUID DEFAULT uuid_generate_v4()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON active_sessions(hotspot_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_router_id ON active_sessions(router_id);
CREATE INDEX IF NOT EXISTS idx_sessions_logout ON active_sessions(logout_at);

-- ============================================================
-- FUNCTION: update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routers_updated_at
    BEFORE UPDATE ON routers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotspot_users_updated_at
    BEFORE UPDATE ON hotspot_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: Admin user default
-- Password: admin123 (bcrypt hash)
-- ============================================================
INSERT INTO admin_users (username, password_hash, full_name, email) VALUES
('admin', '$2b$12$erRtSLvSAg1Ta5cmco388uEAMbExMNMtDRoNgOc1Rd.uwl1an0Uwu', 'Administrator', 'admin@hotspot.local')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- SEED DATA: Sample Router
-- ============================================================
INSERT INTO routers (name, ip_address, api_port, api_username, api_password, location) VALUES
('Router-Utama', '192.168.88.1', 8728, 'admin', '', 'Ruang Server Utama')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA: 3 Sample Hotspot Users
-- ============================================================
INSERT INTO hotspot_users (username, password, full_name, bandwidth_limit, website_block, router_id, notes) VALUES
(
    'user_normal',
    'pass123',
    'Budi Santoso',
    '10M/10M',
    FALSE,
    1,
    'User normal tanpa pembatasan khusus'
),
(
    'user_limited',
    'pass456',
    'Siti Rahayu',
    '2M/512k',
    FALSE,
    1,
    'User dengan bandwidth terbatas 2Mbps download / 512kbps upload'
),
(
    'user_blocked',
    'pass789',
    'Ahmad Fauzi',
    '5M/5M',
    TRUE,
    1,
    'User dengan akses ke npma.my.id diblokir'
)
ON CONFLICT (username) DO NOTHING;
