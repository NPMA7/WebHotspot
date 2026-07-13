import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  {
    group: 'Monitoring',
    items: [
      {
        to: '/admin',
        end: true,
        label: 'Dashboard',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Manajemen',
    items: [
      {
        to: '/admin/users',
        label: 'Pengguna Hotspot',
        badgeKey: 'users',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        to: '/admin/routers',
        label: 'Manajemen Router',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <path d="M6 12h.01M10 12h.01M14 12h.01"/><path d="M8 6V4m8 2V4"/>
          </svg>
        ),
      },
      {
        to: '/admin/hotspot',
        label: 'Hotspot Router',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1"/>
          </svg>
        ),
      },
      {
        to: '/admin/dhcp',
        label: 'DHCP Leases',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Sistem',
    items: [
      {
        to: '/',
        label: 'Captive Portal',
        external: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, badges = {} }) {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem('hotspot_admin') || 'null');
      setAdmin(a);
    } catch (_) {}
  }, []);

  function logout() {
    localStorage.removeItem('hotspot_token');
    localStorage.removeItem('hotspot_admin');
    navigate('/admin/login');
  }

  const initial = admin?.username?.[0]?.toUpperCase() || 'A';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M1.213 8.98a12.006 12.006 0 0121.574 0 1 1 0 01-1.8.87 10.006 10.006 0 00-17.972 0 1 1 0 11-1.802-.87zM5.04 12.68a8 8 0 0113.92 0 1 1 0 01-1.74.98 6 6 0 00-10.44 0 1 1 0 11-1.74-.98zM12 20a2 2 0 100-4 2 2 0 000 4z"/>
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">HotSpot Pro</span>
          <span className="brand-tag">v1.0</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map((item) =>
              item.external ? (
                <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className="nav-item">
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                  {item.badgeKey && badges[item.badgeKey] ? (
                    <span className="nav-badge">{badges[item.badgeKey]}</span>
                  ) : null}
                </NavLink>
              )
            )}
            <div className="divider" />
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initial}</div>
          <div className="user-info">
            <div className="user-name">{admin?.username || 'Admin'}</div>
            <div className="user-role">Super Admin</div>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
