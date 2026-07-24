import { useState, useEffect, useContext, useRef } from 'react';
import { apiFetch } from '../api/client';
import { ToastContext } from '../hooks/ToastContext';
import { Badge, Loader, EmptyState } from '../components/ui/index';

const TABS = [
  { key: 'active', label: 'Sesi Aktif', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
  { key: 'hosts',  label: 'Host Terhubung', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01"/></svg> },
  { key: 'users',  label: 'User Router', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
];

import Modal from '../components/ui/Modal';

function formatBytes(b) {
  const n = parseInt(b) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

function formatSpeed(val) {
  if (!val || val === '0' || val === '0 bps') return '0 bps';
  if (typeof val === 'string' && (val.includes('kbps') || val.includes('Mbps') || val.includes('Gbps') || val.includes('bps'))) {
    return val;
  }
  const n = parseInt(val) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' Mbps';
  if (n >= 1000) return (n / 1000).toFixed(1) + ' kbps';
  return n + ' bps';
}

export default function Hotspot() {
  const ctx = useContext(ToastContext);
  const [routers, setRouters] = useState([]);
  const [routerId, setRouterId] = useState('');
  const [tab, setTab] = useState('active');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ active: 0, hosts: 0, users: 0 });
  const [confirmKick, setConfirmKick] = useState(null);

  useEffect(() => { ctx?.setPageTitle?.('Hotspot Router'); }, [ctx]);

  useEffect(() => {
    apiFetch('/routers').then(d => {
      if (d?.success && d.data.length > 0) {
        setRouters(d.data);
        setRouterId(d.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (routerId) {
      loadTab(tab);
      loadAllCounts();
    }
  }, [routerId, tab]);

  async function loadAllCounts() {
    if (!routerId) return;
    try {
      const [resActive, resHosts, resUsers] = await Promise.all([
        apiFetch(`/hotspot-router/active?router_id=${routerId}`),
        apiFetch(`/hotspot-router/hosts?router_id=${routerId}`),
        apiFetch(`/hotspot-router/users?router_id=${routerId}`)
      ]);
      const validActive = (resActive?.data || []).filter(a => a.user && a.address);
      setCounts({
        active: validActive.length,
        hosts: resHosts?.success ? (resHosts.data || []).length : 0,
        users: resUsers?.success ? (resUsers.data || []).length : 0,
      });
    } catch (err) {
      console.warn('Failed to load counts:', err.message);
    }
  }

  async function loadTab(t) {
    if (!routerId) return;
    setLoading(true);
    setSearch('');
    try {
      let res;
      if (t === 'active') res = await apiFetch(`/hotspot-router/active?router_id=${routerId}`);
      else if (t === 'hosts') res = await apiFetch(`/hotspot-router/hosts?router_id=${routerId}`);
      else res = await apiFetch(`/hotspot-router/users?router_id=${routerId}`);
      if (res?.success) {
        const rawList = res.data || [];
        if (t === 'active') {
          // Filter out rows without valid usernames/address/MAC to clean up stale ghosts
          setData(rawList.filter(a => a.user && a.address));
        } else {
          setData(rawList);
        }
      } else {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function kickSession() {
    if (!confirmKick) return;
    const { id, user } = confirmKick;
    const res = await apiFetch(`/hotspot-router/active/${id}?router_id=${routerId}`, { method: 'DELETE' });
    if (res?.success) {
      ctx?.addToast('Berhasil', `Sesi untuk "${user}" berhasil diputuskan.`, 'success');
      setConfirmKick(null);
      loadTab('active');
      loadAllCounts();
    } else {
      ctx?.addToast('Gagal', res?.message || 'Gagal memutuskan sesi.', 'error');
    }
  }

  async function deleteHost(id) {
    const res = await apiFetch(`/hotspot-router/hosts/${id}?router_id=${routerId}`, { method: 'DELETE' });
    if (res?.success) {
      ctx?.addToast('Berhasil', 'Host dihapus.', 'success');
      loadTab('hosts');
      loadAllCounts();
    } else {
      ctx?.addToast('Gagal', res?.message || 'Gagal menghapus host.', 'error');
    }
  }

  async function deleteUser(id) {
    const res = await apiFetch(`/hotspot-router/users/${id}?router_id=${routerId}`, { method: 'DELETE' });
    if (res?.success) {
      ctx?.addToast('Berhasil', 'User lokal dihapus.', 'success');
      loadTab('users');
      loadAllCounts();
    } else {
      ctx?.addToast('Gagal', res?.message || 'Gagal menghapus user.', 'error');
    }
  }

  const filtered = data.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return Object.values(row).some(v => String(v).toLowerCase().includes(s));
  });

  function renderTable() {
    if (tab === 'active') {
      return (
        <table className="data-table">
          <thead><tr>
            <th>User</th><th>IP Address</th><th>MAC</th><th>Uptime</th>
            <th>Traffic Realtime (DL / UL)</th><th>Total Kuota (Kumulatif)</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
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
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => setConfirmKick({ id: s.id || s['.id'], user: s.user })}>
                    Kick
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (tab === 'hosts') {
      return (
        <table className="data-table">
          <thead><tr>
            <th>MAC</th><th>IP Address</th><th>Server</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: '0.72rem' }}>{h.mac_address || h['mac-address'] || '—'}</td>
                <td className="mono">{h.address || '—'}</td>
                <td>{h.server || '—'}</td>
                <td>
                  <Badge variant={h.bypass === 'true' || h.bypass === true ? 'success' : 'neutral'}>
                    {h.bypass === 'true' || h.bypass === true ? 'Bypass' : 'Normal'}
                  </Badge>
                </td>
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => deleteHost(h.id || h['.id'])}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // users
    return (
      <table className="data-table">
        <thead><tr>
          <th>Username</th><th>Password</th><th>Profile</th><th>Komentar</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          {filtered.map((u, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
              <td className="mono" style={{ fontSize: '0.72rem' }}>{u.password || '—'}</td>
              <td>{u.profile || '—'}</td>
              <td style={{ color: 'var(--text-muted)', maxWidth: 180 }}>{u.comment || '—'}</td>
              <td>
                <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u.id || u['.id'])}>
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      {/* Router selector */}
      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={routerId} onChange={e => setRouterId(e.target.value)}>
          {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.ip_address})</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => loadTab(tab)} disabled={loading}>
          {loading ? <div className="loader-ring" style={{ width: 13, height: 13, borderWidth: 2 }} /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
          )}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            <span className="tab-badge">{counts[t.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            {TABS.find(t => t.key === tab)?.icon}
            {TABS.find(t => t.key === tab)?.label}
            <Badge variant="primary">{filtered.length}</Badge>
          </div>
          <div className="search-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="search-input" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <EmptyState icon="📡" text={`Tidak ada data ${TABS.find(t => t.key === tab)?.label.toLowerCase()}.`} />
          ) : (
            renderTable()
          )}
        </div>
      </div>

      {/* Kick Active Session Modal */}
      <Modal
        open={!!confirmKick}
        onClose={() => setConfirmKick(null)}
        title="Putuskan Sesi Aktif (Kick)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmKick(null)}>Batal</button>
            <button className="btn btn-danger" onClick={kickSession}>Putuskan Sesi</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Yakin ingin memutuskan sesi aktif untuk user <strong style={{ color: 'var(--text)' }}>"{confirmKick?.user}"</strong>?
        </p>
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>
          ⚠ Perangkat akan didepak dan harus masuk (login) kembali melalui captive portal untuk mengakses internet.
        </p>
      </Modal>
    </>
  );
}
