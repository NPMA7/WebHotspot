import { useState, useEffect, useCallback, useContext } from 'react';
import { apiFetch } from '../api/client';
import { ToastContext } from '../hooks/ToastContext';
import { StatCard, Loader, EmptyState, Badge } from '../components/ui/index';
import Modal from '../components/ui/Modal';

function formatBytes(b) {
  const n = parseInt(b) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

function formatRate(val) {
  if (!val || val === '0' || val === '0/0') return '0 bps';
  if (typeof val === 'string' && (val.includes('k') || val.includes('M') || val.includes('G') || val.includes('bps'))) {
    return val;
  }
  const n = typeof val === 'number' ? val : (parseInt(val) || 0);
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + ' Gbps';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' Mbps';
  if (n >= 1000) return (n / 1000).toFixed(1) + ' kbps';
  return n + ' bps';
}

function formatPairRate(pairStr) {
  if (!pairStr || pairStr === '0/0') return { ul: '0 bps', dl: '0 bps' };
  const parts = pairStr.split('/');
  return {
    ul: formatRate(parts[0]),
    dl: formatRate(parts[1] || parts[0]),
  };
}

function formatPairBytes(pairStr) {
  if (!pairStr || pairStr === '0/0') return { ul: '0 B', dl: '0 B' };
  const parts = pairStr.split('/');
  return {
    ul: formatBytes(parts[0]),
    dl: formatBytes(parts[1] || parts[0]),
  };
}

export default function Queues() {
  const ctx = useContext(ToastContext);
  const [routers, setRouters] = useState([]);
  const [routerId, setRouterId] = useState('');
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { ctx?.setPageTitle?.('Simple Queues'); }, [ctx]);

  // Load router list
  useEffect(() => {
    apiFetch('/routers').then(d => {
      if (d?.success && d.data.length > 0) {
        setRouters(d.data);
        setRouterId(d.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const loadQueues = useCallback(async (rId) => {
    if (!rId) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/queues/${rId}`);
      if (d?.success) {
        setQueues(d.data || []);
      } else {
        ctx?.addToast?.('warning', d?.message || 'Gagal memuat Simple Queues');
      }
    } catch (err) {
      ctx?.addToast?.('danger', err.message);
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    if (routerId) {
      loadQueues(routerId);
      const timer = setInterval(() => loadQueues(routerId), 10000);
      return () => clearInterval(timer);
    }
  }, [routerId, loadQueues]);

  async function handleQueueAction(queueId, action) {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/queues/${routerId}/action`, {
        method: 'POST',
        body: JSON.stringify({ queue_id: queueId, action }),
      });
      if (res?.success) {
        ctx?.addToast?.('success', res.message || 'Aksi berhasil');
        loadQueues(routerId);
      } else {
        ctx?.addToast?.('danger', res?.message || 'Gagal mengeksekusi aksi');
      }
    } catch (err) {
      ctx?.addToast?.('danger', err.message);
    } finally {
      setActionLoading(false);
      setConfirmDelete(null);
    }
  }

  const filtered = queues.filter(q => {
    const term = search.toLowerCase();
    return (
      (q.name || '').toLowerCase().includes(term) ||
      (q.target || '').toLowerCase().includes(term) ||
      (q.comment || '').toLowerCase().includes(term)
    );
  });

  const totalQueues = queues.length;
  const activeQueues = queues.filter(q => !q.disabled).length;
  const disabledQueues = queues.filter(q => q.disabled).length;

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <StatCard
          title="Total Simple Queues"
          value={totalQueues}
          sub="Aturan limit bandwidth aktif"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          accent="var(--primary)"
        />
        <StatCard
          title="Queue Aktif"
          value={activeQueues}
          sub="Sedang membatasi traffic"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          accent="var(--success)"
        />
        <StatCard
          title="Queue Non-Aktif"
          value={disabledQueues}
          sub="Di-disable oleh admin"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
          accent="var(--warning)"
        />
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pilih Router:</span>
            <select
              className="form-control"
              style={{ width: 220, padding: '6px 12px' }}
              value={routerId}
              onChange={e => setRouterId(e.target.value)}
            >
              {routers.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.ip_address})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Cari queue / IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => loadQueues(routerId)} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading && queues.length === 0 ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <EmptyState icon="📊" text="Tidak ada Simple Queue ditemukan." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Queue</th>
                  <th>Target IP / Subnet</th>
                  <th>Max Limit (UL / DL)</th>
                  <th>Traffic Realtime (DL / UL)</th>
                  <th>Total Traffic (DL / UL)</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => {
                  const limits = formatPairRate(q.max_limit);
                  const rates = formatPairRate(q.rate);
                  const bytes = formatPairBytes(q.bytes);
                  return (
                    <tr key={i} style={{ opacity: q.disabled ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: q.disabled ? 'var(--text-muted)' : '#10b981'
                          }} />
                          {q.name}
                        </div>
                      </td>
                      <td className="mono">{q.target || '—'}</td>
                      <td>
                        <span style={{ color: '#8b5cf6', fontWeight: 600, marginRight: 6 }}>↑ {limits.ul}</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>↓ {limits.dl}</span>
                      </td>
                      <td>
                        <span style={{ color: '#10b981', fontWeight: 600, marginRight: 8 }}>↓ {rates.dl}</span>
                        <span style={{ color: '#8b5cf6', fontWeight: 600 }}>↑ {rates.ul}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>↓ {bytes.dl}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>(↑ {bytes.ul})</span>
                      </td>
                      <td>
                        <Badge variant={q.disabled ? 'neutral' : 'success'}>
                          {q.disabled ? 'Disabled' : 'Active'}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className={`btn btn-xs ${q.disabled ? 'btn-success' : 'btn-warning'}`}
                            onClick={() => handleQueueAction(q.id, q.disabled ? 'enable' : 'disable')}
                            disabled={actionLoading}
                          >
                            {q.disabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => setConfirmDelete(q)}
                            disabled={actionLoading}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmDelete(null)}
          title="Konfirmasi Hapus Queue"
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Apakah Anda yakin ingin menghapus Simple Queue <strong>{confirmDelete.name}</strong> ({confirmDelete.target}) dari router?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
              Batal
            </button>
            <button
              className="btn btn-danger"
              onClick={() => handleQueueAction(confirmDelete.id, 'remove')}
              disabled={actionLoading}
            >
              {actionLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
