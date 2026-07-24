import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toast from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import { ToastContext } from '../../hooks/ToastContext';
import { apiFetch } from '../../api/client';

export default function Layout() {
  const navigate = useNavigate();
  const { toasts, addToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [badges, setBadges] = useState({});

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('hotspot_token');
    if (!token) navigate('/admin/login');
  }, [navigate]);

  // Load badge counts
  useEffect(() => {
    apiFetch('/dashboard/summary').then(data => {
      if (data?.success) {
        setBadges({ users: data.data.total_users });
      }
    }).catch(() => {});
  }, []);

  function toggleSidebar() {
    if (window.innerWidth <= 900) {
      setMobileOpen(v => !v);
    } else {
      setCollapsed(v => !v);
    }
  }

  function closeMobile() { setMobileOpen(false); }

  return (
    <ToastContext.Provider value={{ addToast, setPageTitle }}>
      <div className="app-layout">
        {/* Mobile overlay */}
        <div
          className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
          onClick={closeMobile}
        />

        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggle={toggleSidebar}
          onCloseMobile={closeMobile}
          badges={badges}
        />

        <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Top Header */}
          <header className="top-header">
            <button className="btn btn-ghost btn-icon btn-toggle-sidebar" onClick={toggleSidebar} aria-label="Toggle Sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="header-title">{pageTitle}</div>
            </div>
          </header>

          {/* Page content */}
          <div className="page-content">
            <Outlet />
          </div>
        </main>

        <Toast toasts={toasts} />
      </div>
    </ToastContext.Provider>
  );
}
