import { useState, useEffect, useCallback, useContext } from 'react';
import { apiFetch } from '../api/client';
import { ToastContext } from '../hooks/ToastContext';
import { StatCard, Loader, EmptyState } from '../components/ui/index';
import { Badge } from '../components/ui/index';

function formatBytes(b) {
  const n = parseInt(b) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

function formatSpeed(val) {
  if (!val || val === '0' || val === '0 bps' || val === 0) return '0 bps';
  if (typeof val === 'string' && (val.includes('kbps') || val.includes('Mbps') || val.includes('Gbps') || val.includes('bps'))) {
    return val;
  }
  const n = typeof val === 'number' ? val : (parseInt(val) || 0);
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + ' Gbps';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' Mbps';
  if (n >= 1000) return (n / 1000).toFixed(1) + ' kbps';
  return n + ' bps';
}

function ResourceBar({ label, value, max, unit = '%', color = 'var(--primary)' }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = pct > 85 ? 'var(--danger)' : pct > 65 ? 'var(--warning)' : color;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}<span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{unit}</span></span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const ctx = useContext(ToastContext);
  const [routers, setRouters] = useState([]);
  const [routerId, setRouterId] = useState('');
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => { ctx?.setPageTitle?.('Dashboard'); }, [ctx]);

  const loadRoutersAndSummary = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        apiFetch('/routers'),
        apiFetch('/dashboard/summary'),
      ]);
      if (rRes?.success && rRes.data.length > 0) {
        setRouters(rRes.data);
        setRouterId(prev => prev || rRes.data[0].id);
      }
      if (sRes?.success) setSummary(sRes.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadRoutersAndSummary();
  }, [loadRoutersAndSummary]);

  const loadRouterData = useCallback(async () => {
    if (!routerId) return;
    setLoading(true);
    try {
      const [statsRes, sessRes] = await Promise.all([
        apiFetch(`/dashboard/${routerId}/stats`),
        apiFetch(`/dashboard/${routerId}/sessions`),
      ]);
      if (statsRes?.success) setStats(statsRes.data);
      if (sessRes?.success) setSessions(sessRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [routerId]);

  useEffect(() => {
    if (routerId) { loadRouterData(); setCountdown(30); }
  }, [routerId, loadRouterData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { 
          loadRoutersAndSummary();
          loadRouterData(); 
          return 30; 
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadRouterData, loadRoutersAndSummary]);

  return (
    <>
      {/* Summary Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Pengguna"
          value={summary?.total_users ?? '—'}
          variant="primary"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
        />
        <StatCard
          label="Router Aktif"
          value={routers.length}
          variant="success"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01"/></svg>}
        />
        <StatCard
          label="Sesi Aktif (DB)"
          value={summary?.active_sessions_db ?? '—'}
          variant="info"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><circle cx="12" cy="20" r="1"/></svg>}
        />
        <StatCard
          label="User Diblokir"
          value={summary?.blocked_users ?? '—'}
          variant="warning"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
        />
      </div>

      {/* Router Selector + Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Router Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
              Pilih Router
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Refresh: <strong style={{ color: 'var(--primary-light)' }}>{countdown}s</strong>
            </span>
          </div>
          <div className="card-body">
            <select
              className="select"
              value={routerId}
              onChange={e => setRouterId(e.target.value)}
            >
              {routers.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.ip_address})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resources */}
        {stats && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                {stats.router_name || 'Router'} — Sumber Daya
              </div>
              <Badge variant="success">Online</Badge>
            </div>
            <div className="card-body">
              <ResourceBar label="CPU Load" value={parseFloat(stats.cpu_load) || 0} max={100} unit="%" />
              <ResourceBar label={`RAM — Free: ${stats.free_memory_mb} MB`} value={parseFloat(stats.memory_percent) || 0} max={100} unit="%" color="var(--accent)" />
              <ResourceBar label={`HDD — Free: ${stats.free_hdd_mb} MB`} value={parseFloat(stats.hdd_percent) || 0} max={100} unit="%" color="var(--success)" />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Uptime: <strong style={{ color: 'var(--text)' }}>{stats.uptime || '—'}</strong></span>
                <span>Ver: <strong style={{ color: 'var(--text)' }}>{stats.version || '—'}</strong></span>
                <span>Board: <strong style={{ color: 'var(--text)' }}>{stats.board_name || '—'}</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Sesi Aktif Sekarang
            <Badge variant="primary">{sessions.length}</Badge>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { loadRoutersAndSummary(); if (routerId) loadRouterData(); }} disabled={loading}>
            {loading ? <div className="loader-ring" style={{ width: 14, height: 14, borderWidth: 2 }} /> : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
            )}
            Refresh
          </button>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <Loader />
          ) : sessions.length === 0 ? (
            <EmptyState icon="📡" text="Tidak ada sesi aktif saat ini." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>MAC</th>
                  <th>Uptime</th>
                  <th>Traffic Realtime (DL / UL)</th>
                  <th>Total Kuota (Kumulatif)</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.user || '—'}</td>
                    <td className="mono">{s.address || '—'}</td>
                    <td className="mono" style={{ fontSize: '0.72rem' }}>{s.mac || s['mac-address'] || '—'}</td>
                    <td>{s.uptime || '—'}</td>
                    <td>
                      <span style={{ color: '#10b981', fontWeight: 600, marginRight: 8 }}>
                        ↓ {formatSpeed(s.tx_rate || s['tx-rate'])}
                      </span>
                      <span style={{ color: '#8b5cf6', fontWeight: 600 }}>
                        ↑ {formatSpeed(s.rx_rate || s['rx-rate'])}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        ↓ {formatBytes(s.bytes_out || s['bytes-out'])}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 8 }}>
                        (↑ {formatBytes(s.bytes_in || s['bytes-in'])})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
