import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('hotspot_token')) navigate('/admin');
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('hotspot_token', data.token);
        localStorage.setItem('hotspot_admin', JSON.stringify(data.admin));
        navigate('/admin');
      } else {
        setError(data.message || 'Login gagal.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" style={{ color: 'white' }}>
            <path d="M1.213 8.98a12.006 12.006 0 0121.574 0 1 1 0 01-1.8.87 10.006 10.006 0 00-17.972 0 1 1 0 11-1.802-.87zM5.04 12.68a8 8 0 0113.92 0 1 1 0 01-1.74.98 6 6 0 00-10.44 0 1 1 0 11-1.74-.98zM12 20a2 2 0 100-4 2 2 0 000 4z"/>
          </svg>
        </div>
        <div style={styles.badge}>ADMIN PANEL</div>
        <h1 style={styles.title}>HotSpot <span style={{ color: 'var(--primary-light)' }}>Management</span></h1>
        <p style={styles.sub}>Masuk ke dashboard administrator</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          {error && (
            <div style={styles.alert}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username Admin</label>
            <div style={{ position: 'relative' }}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                type="text"
                placeholder="admin"
                autoCapitalize="none"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                className="input"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={styles.eyeBtn}
              >
                {showPwd
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: 8, fontSize: '0.9rem' }}
            disabled={loading}
          >
            {loading ? <><div className="loader-ring" style={{ width: 16, height: 16, borderWidth: 2 }} /> Masuk...</> : 'Masuk ke Dashboard'}
          </button>
        </form>

        <div style={styles.footer}>
          ← Kembali ke <a href="/" style={{ color: 'var(--primary-light)' }}>Captive Portal</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-body)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'fixed', inset: 0, zIndex: 0,
    background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.06) 0%, transparent 50%)',
  },
  orb1: { position: 'fixed', top: '-15%', left: '-10%', width: 500, height: 500, background: 'rgba(99,102,241,0.06)', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 },
  orb2: { position: 'fixed', bottom: '-20%', right: '-10%', width: 600, height: 600, background: 'rgba(6,182,212,0.04)', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0 },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  iconWrap: {
    width: 60, height: 60,
    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
    borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.25)',
    color: '#fbbf24',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 99,
    letterSpacing: '0.08em',
    marginBottom: 10,
  },
  title: { fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 },
  sub: { fontSize: '0.83rem', color: 'var(--text-muted)' },
  alert: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    textAlign: 'left',
  },
  inputIcon: {
    position: 'absolute',
    left: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center',
  },
  footer: { marginTop: 24, fontSize: '0.78rem', color: 'var(--text-muted)' },
};
