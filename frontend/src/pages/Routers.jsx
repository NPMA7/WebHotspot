import { useState, useEffect, useContext } from 'react';
import { apiFetch, apiPost, apiPut, apiDelete } from '../api/client';
import { ToastContext } from '../hooks/ToastContext';
import Modal from '../components/ui/Modal';
import { Badge, Loader, EmptyState } from '../components/ui/index';

const EMPTY_FORM = { name: '', ip_address: '', api_port: 8728, api_username: 'admin', api_password: '', location: '' };

function RouterCard({ router, onEdit, onDelete, onTest }) {
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    await onTest(router);
    setTesting(false);
  }

  const lastSeen = router.last_seen
    ? new Date(router.last_seen).toLocaleString('id-ID')
    : 'Belum pernah';

  return (
    <div className="router-card">
      <div className="router-card-header">
        <div className="router-card-name">{router.name}</div>
        <Badge variant={router.is_active ? 'success' : 'neutral'}>
          {router.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      </div>
      <div className="router-card-detail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
        <span className="mono">{router.ip_address}:{router.api_port}</span>
      </div>
      <div className="router-card-detail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>{router.api_username}</span>
      </div>
      {router.location && (
        <div className="router-card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{router.location}</span>
        </div>
      )}
      <div className="router-card-detail" style={{ color: 'var(--text-muted)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Last seen: {lastSeen}</span>
      </div>
      <div className="router-card-actions">
        <button className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testing}>
          {testing ? <div className="loader-ring" style={{ width: 12, height: 12, borderWidth: 2 }} /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          )}
          Test
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(router)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(router)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          Hapus
        </button>
      </div>
    </div>
  );
}

export default function Routers() {
  const ctx = useContext(ToastContext);
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRouter, setEditRouter] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { ctx?.setPageTitle?.('Manajemen Router'); }, [ctx]);
  useEffect(() => { loadRouters(); }, []);

  async function loadRouters() {
    setLoading(true);
    try {
      const d = await apiFetch('/routers');
      if (d?.success) {
        setRouters(d.data || []);
      }
    } catch (err) {
      ctx?.addToast?.('danger', err.message || 'Gagal memuat daftar router.');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditRouter(null);
    setForm(EMPTY_FORM);
    setModal(true);
  }

  function openEdit(r) {
    setEditRouter(r);
    setForm({ name: r.name, ip_address: r.ip_address, api_port: r.api_port, api_username: r.api_username, api_password: '', location: r.location || '' });
    setModal(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, api_port: parseInt(form.api_port) || 8728 };
      const res = editRouter
        ? await apiPut(`/routers/${editRouter.id}`, body)
        : await apiPost('/routers', body);
      if (res?.success) {
        ctx?.addToast('Berhasil', res.message || 'Disimpan.', 'success');
        setModal(false);
        loadRouters();
      } else {
        ctx?.addToast('Gagal', res?.message || 'Terjadi kesalahan.', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(router) {
    const res = await apiFetch(`/routers/${router.id}/test`);
    if (res?.success) {
      ctx?.addToast('Koneksi Berhasil', `Identity: "${res.data?.identity}"`, 'success');
      loadRouters();
    } else {
      ctx?.addToast('Koneksi Gagal', res?.message || 'Tidak dapat terhubung.', 'error');
    }
  }

  async function deleteRouter() {
    if (!confirmDel) return;
    const res = await apiDelete(`/routers/${confirmDel.id}`);
    if (res?.success) {
      ctx?.addToast('Dihapus', res.message || 'Router dihapus.', 'success');
      setConfirmDel(null);
      loadRouters();
    } else {
      ctx?.addToast('Gagal', res?.message || 'Gagal menghapus.', 'error');
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01"/>
            </svg>
            Daftar Router
            <Badge variant="primary">{routers.length}</Badge>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tambah Router
          </button>
        </div>

        {loading ? (
          <div className="card-body"><Loader /></div>
        ) : routers.length === 0 ? (
          <div className="card-body"><EmptyState icon="🖥️" text="Belum ada router. Klik 'Tambah Router'." /></div>
        ) : (
          <div className="card-body">
            <div className="routers-grid">
              {routers.map(r => (
                <RouterCard
                  key={r.id}
                  router={r}
                  onEdit={openEdit}
                  onDelete={setConfirmDel}
                  onTest={handleTest}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editRouter ? `Edit Router — ${editRouter.name}` : 'Tambah Router Baru'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={submitForm} disabled={saving}>
              {saving ? <div className="loader-ring" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              Simpan
            </button>
          </>
        }
      >
        <form onSubmit={submitForm}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Router *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Router Utama" required />
            </div>
            <div className="form-group">
              <label className="form-label">IP Address *</label>
              <input className="input" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.88.1" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">API Port</label>
              <input className="input" type="number" value={form.api_port} onChange={e => setForm(f => ({ ...f, api_port: e.target.value }))} placeholder="8728" />
            </div>
            <div className="form-group">
              <label className="form-label">Lokasi</label>
              <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Lantai 1, Gedung A" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username API *</label>
              <input className="input" value={form.api_username} onChange={e => setForm(f => ({ ...f, api_username: e.target.value }))} placeholder="admin" required autoCapitalize="none" />
            </div>
            <div className="form-group">
              <label className="form-label">{editRouter ? 'Password API (kosongkan jika tidak ganti)' : 'Password API *'}</label>
              <input className="input" type="password" value={form.api_password} onChange={e => setForm(f => ({ ...f, api_password: e.target.value }))} placeholder="••••••••" required={!editRouter} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Hapus Router"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Batal</button>
            <button className="btn btn-danger" onClick={deleteRouter}>Hapus</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Yakin ingin menghapus router <strong style={{ color: 'var(--text)' }}>"{confirmDel?.name}"</strong>?
        </p>
      </Modal>
    </>
  );
}
