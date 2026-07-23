import { useState, useEffect } from 'react';

export default function PortalLogin() {
  const [params, setParams] = useState({ ip: '', mac: '', linkLogin: '', linkLoginOnly: '', dst: '', error: '' });
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('waiting'); // waiting, authenticating, connected, failed
  const [alert, setAlert] = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setParams({
      ip: urlParams.get('ip') || '',
      mac: urlParams.get('mac') || '',
      linkLogin: urlParams.get('link-login') || '',
      linkLoginOnly: urlParams.get('link-login-only') || '',
      dst: urlParams.get('dst') || '',
      error: urlParams.get('error') || '',
    });
    if (urlParams.get('error')) {
      setAlert({ type: 'error', msg: urlParams.get('error') });
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setAlert({ type: 'error', msg: 'Username dan password tidak boleh kosong.' });
      return;
    }

    setLoading(true);
    setStatus('authenticating');

    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ip: params.ip,
          mac: params.mac,
          link_login: params.linkLogin,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('connected');
        setAlert({
          type: 'success',
          msg: `Selamat datang, ${data.data?.full_name || username}! Menghubungkan ke internet...`,
        });

        setTimeout(() => {
          let targetDst = params.dst || 'https://www.google.com';
          const rawDst = decodeURIComponent(targetDst);

          if (
            !targetDst ||
            rawDst.includes('generate_204') ||
            rawDst.includes('gstatic.com') ||
            rawDst.includes('msftconnecttest') ||
            rawDst.includes('connectivitycheck') ||
            rawDst.includes('captive.apple.com') ||
            rawDst.includes('detectportal') ||
            rawDst.includes('$(dst)') ||
            rawDst.includes('192.168.')
          ) {
            targetDst = 'https://www.google.com';
          }

          if (params.linkLogin) {
            const actionUrl = params.linkLogin.split('?')[0];
            const formEl = document.createElement('form');
            formEl.method = 'POST';
            formEl.action = actionUrl;
            formEl.style.display = 'none';

            const addField = (n, v) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = n;
              input.value = v;
              formEl.appendChild(input);
            };

            addField('username', username);
            addField('password', password);
            addField('dst', targetDst);
            addField('popup', 'true');

            document.body.appendChild(formEl);
            try { formEl.submit(); } catch (_) {}

            setTimeout(() => {
              window.location.href = targetDst;
            }, 800);
          } else {
            window.location.href = targetDst;
          }
        }, 1200);
      } else {
        setStatus('failed');
        setAlert({ type: 'error', msg: data.message || 'Login gagal. Periksa username dan password.' });
        setLoading(false);
      }
    } catch (err) {
      setStatus('failed');
      setAlert({ type: 'error', msg: 'Tidak dapat terhubung ke server portal.' });
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" style={{ color: 'white' }}>
              <path d="M1.213 8.98a12.006 12.006 0 0121.574 0 1 1 0 01-1.8.87 10.006 10.006 0 00-17.972 0 1 1 0 11-1.802-.87zM5.04 12.68a8 8 0 0113.92 0 1 1 0 01-1.74.98 6 6 0 00-10.44 0 1 1 0 11-1.74-.98zM12 20a2 2 0 100-4 2 2 0 000 4zm0-6a4 4 0 100 8 4 4 0 000-8z"/>
            </svg>
          </div>
          <h1 style={styles.title}>Selamat <span style={{ color: 'var(--primary-light)' }}>Datang</span></h1>
          <p style={styles.subTitle}>Masuk untuk mengakses internet hotspot</p>
        </div>

        <div style={styles.card}>
          {/* Network Info */}
          <div style={styles.netInfo}>
            <div style={styles.netItem}>
              <div style={styles.netLabel}>IP ANDA</div>
              <div style={styles.netValue}>{params.ip || 'Deteksi...'}</div>
            </div>
            <div style={styles.netDivider} />
            <div style={styles.netItem}>
              <div style={styles.netLabel}>MAC</div>
              <div style={styles.netValue}>{params.mac || 'N/A'}</div>
            </div>
            <div style={styles.netDivider} />
            <div style={styles.netItem}>
              <div style={styles.netLabel}>STATUS</div>
              <div style={styles.netValue}>
                <span style={{
                  ...styles.statusDot,
                  backgroundColor: status === 'connected' ? 'var(--success)' : status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                  animation: status === 'authenticating' ? 'blink 1.5s ease-in-out infinite' : 'none'
                }} />
                {status === 'waiting' && 'Menunggu'}
                {status === 'authenticating' && 'Verifikasi...'}
                {status === 'connected' && 'Terhubung'}
                {status === 'failed' && 'Gagal'}
              </div>
            </div>
          </div>

          {alert && (
            <div style={{
              ...styles.alert,
              background: alert.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              borderColor: alert.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
              color: alert.type === 'error' ? '#fca5a5' : '#6ee7b7',
            }}>
              {alert.msg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  className="input"
                  style={{ paddingLeft: 38 }}
                  type="text"
                  placeholder="Masukkan username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  autoCapitalize="none"
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
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Masukkan password"
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
              style={{ width: '100%', padding: '12px', marginTop: 10, fontSize: '0.9rem' }}
              disabled={loading}
            >
              {loading ? <><div className="loader-ring" style={{ width: 16, height: 16, borderWidth: 2 }} /> Menyambungkan...</> : 'Masuk ke Internet'}
            </button>
          </form>
        </div>

        <div style={styles.footer}>
          <p>Butuh bantuan? Hubungi administrator jaringan</p>
          {/* <p style={{ marginTop: 6 }}>
            Admin? <a href="/admin/login" style={{ color: 'var(--primary-light)' }}>Masuk ke Dashboard</a>
          </p> */}
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
  orb1: { position: 'fixed', top: '-15%', left: '-10%', width: 500, height: 500, background: 'rgba(99,102,241,0.05)', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 },
  orb2: { position: 'fixed', bottom: '-20%', right: '-10%', width: 600, height: 600, background: 'rgba(6,182,212,0.03)', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0 },
  wrapper: { width: '100%', maxWidth: 430, position: 'relative', zIndex: 1 },
  header: { textAlign: 'center', marginBottom: 20 },
  logo: {
    width: 54, height: 54,
    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
    borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px',
  },
  title: { fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 },
  subTitle: { fontSize: '0.8rem', color: 'var(--text-secondary)' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px 20px',
  },
  netInfo: {
    display: 'flex',
    gap: 8,
    padding: 12,
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 20,
  },
  netItem: { flex: 1, textAlign: 'center' },
  netLabel: { fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 },
  netValue: { fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600, fontFamily: 'monospace' },
  netDivider: { width: 1, background: 'var(--border)', alignSelf: 'stretch' },
  statusDot: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 5, verticalAlign: 'middle' },
  alert: {
    border: '1px solid',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '0.8rem',
    marginBottom: 16,
  },
  inputIcon: {
    position: 'absolute',
    left: 12, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center',
  },
  footer: { textAlign: 'center', marginTop: 20, fontSize: '0.75rem', color: 'var(--text-secondary)' },
};
