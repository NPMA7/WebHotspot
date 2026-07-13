export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatCard({ icon, label, value, variant = 'primary' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${variant}`}>{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function Loader() {
  return (
    <div className="page-loader">
      <div className="loader-ring" />
      Memuat...
    </div>
  );
}

export function EmptyState({ icon = '📭', text = 'Tidak ada data.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
    </div>
  );
}
