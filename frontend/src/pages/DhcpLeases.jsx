import { useState, useEffect, useContext } from 'react';
import { apiFetch } from '../api/client';
import { ToastContext } from '../hooks/ToastContext';
import { Badge, Loader, EmptyState } from '../components/ui/index';
import Modal from '../components/ui/Modal';

export default function DhcpLeases() {
  const ctx = useContext(ToastContext);
  const [routers, setRouters] = useState([]);
  const [routerId, setRouterId] = useState('');
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { ctx?.setPageTitle?.('DHCP Leases'); }, [ctx]);

  useEffect(() => {
    apiFetch('/routers').then(d => {
      if (d?.success && d.data.length > 0) {
        setRouters(d.data);
        setRouterId(d.data[0].id);
      }
    });
  }, []);

  useEffect(() => { if (routerId) load(); }, [routerId]);

  async function load() {
    if (!routerId) return;
    setLoading(true);
    const d = await apiFetch(`/dhcp/leases?router_id=${routerId}`);
    if (d?.success) {
      const rawLeases = d.data || [];
      // Filter out empty/ghost leases without IP or MAC
      setLeases(rawLeases.filter(l => l.address && l.mac_address));
    }
    setLoading(false);
  }

  async function deleteLease() {
    if (!confirmDel) return;
    const { id, address } = confirmDel;
    const res = await apiFetch(`/dhcp/leases/${id}?router_id=${routerId}`, { method: 'DELETE' });
    if (res?.success) {
      ctx?.addToast('Berhasil', `Lease ${address} berhasil dihapus & koneksi diputuskan.`, 'success');
      setConfirmDel(null);
      load();
    } else {
      ctx?.addToast('Gagal', res?.message || 'Gagal menghapus lease.', 'error');
    }
  }

  const filtered = leases.filter(l => {
    const matchSearch = !search || [l.address, l.mac_address, l.host_name, l.client_id].some(v => (v || '').toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(leases.map(l => l.status).filter(Boolean))];

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            DHCP Leases
            <Badge variant="primary">{filtered.length}</Badge>
          </div>
          <div className="card-actions">
            <select className="select" style={{ width: 'auto', minWidth: 160 }} value={routerId} onChange={e => setRouterId(e.target.value)}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="select" style={{ width: 'auto', minWidth: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Semua Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="search-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="search-input" placeholder="Cari IP/MAC/host..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
              {loading
                ? <div className="loader-ring" style={{ width: 13, height: 13, borderWidth: 2 }} />
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
              }
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <EmptyState icon="📋" text="Tidak ada DHCP lease ditemukan." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Hostname</th>
                  <th>Server</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Type</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontWeight: 600 }}>{l.address || '—'}</td>
                    <td className="mono" style={{ fontSize: '0.72rem' }}>{l.mac_address || '—'}</td>
                    <td>{l.host_name || '—'}</td>
                    <td>{l.server || '—'}</td>
                    <td>
                      <Badge variant={l.status === 'bound' ? 'success' : l.status === 'waiting' ? 'warning' : 'neutral'}>
                        {l.status || '—'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.expires_after || '—'}</td>
                    <td>
                      <Badge variant={l.dynamic === 'true' || l.dynamic === true ? 'info' : 'neutral'}>
                        {l.dynamic === 'true' || l.dynamic === true ? 'dynamic' : 'static'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => setConfirmDel({ id: l.id, address: l.address })}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Lease Confirm Modal */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Hapus DHCP Lease"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Batal</button>
            <button className="btn btn-danger" onClick={deleteLease}>Hapus & Putuskan</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Yakin ingin menghapus DHCP lease untuk IP <strong style={{ color: 'var(--text)' }}>{confirmDel?.address}</strong>?
        </p>
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>
          ⚠ Perangkat akan terputus dari jaringan dan harus meminta IP baru (reconnect).
        </p>
      </Modal>
    </>
  );
}
