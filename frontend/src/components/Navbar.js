import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';

/* ─── Route → page meta map ───────────────────────────────────── */
const PAGE_META = {
  '/':          { title: 'Overview',     icon: '◎', sub: 'Business at a glance' },
  '/orders':    { title: 'Orders',       icon: '⊡', sub: 'Manage and track orders' },
  '/customers': { title: 'Customers',    icon: '◉', sub: 'Customer records' },
  '/products':  { title: 'Products',     icon: '⬡', sub: 'Product catalogue' },
  '/inventory': { title: 'Inventory',    icon: '⊞', sub: 'Stock levels and alerts' },
  '/riders':    { title: 'Riders',       icon: '⊕', sub: 'Rider management' },
  '/cash':      { title: 'Cash Control', icon: '◈', sub: 'Track and verify collections' },
  '/payments':  { title: 'Payments',     icon: '⊛', sub: 'Payment records' },
  '/reports':   { title: 'Reports',      icon: '◐', sub: 'Analytics and performance' },
  '/billing':   { title: 'New Bill',     icon: '💳', sub: 'Create a new bill' },
  '/receipts':  { title: 'Receipts',     icon: '🧾', sub: 'Receipt history' },
  '/users':     { title: 'Staff',        icon: '◑', sub: 'Team and permissions' },
  '/delivery':  { title: 'Delivery Board', icon: '🏍️', sub: 'Assign riders and track deliveries' },
  '/settings':  { title: 'Settings',      icon: '⚙️', sub: 'Account and system configuration' },
};

const roleColors = {
  super_admin: '#ef4444',
  admin:       '#f59e0b',
  manager:     '#3b82f6',
  cashier:     '#22c55e',
  dispatcher:  '#8b5cf6',
  warehouse:   '#14b8a6',
  rider:       '#f97316',
};



const NOTIF_ICONS = {
  order: '⊡', cash: '◈', stock: '⬡', payment: '⊛',
};

const Navbar = ({ onMenuOpen }) => {
  const { user, logout }    = useAuth();
  const location            = useLocation();
  const navigate            = useNavigate();

  const [profileOpen, setProfileOpen]     = useState(false);
  const [notifOpen,   setNotifOpen]       = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  const meta      = PAGE_META[location.pathname] || { title: 'Shorewinds', icon: '◎', sub: '' };
  const roleColor = roleColors[user?.role] || '#94a3b8';
  const unread    = notifications.filter(n => !n.read).length;

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Close on route change */
  useEffect(() => {
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  /* Fetch real notifications */
  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await API.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const markAllRead  = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const markRead     = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <>
      <style>{`
        /* ── Navbar base ── */
        .pc-nav {
          height: 60px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 50;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
        }

        /* ── Left side ── */
        .pc-nav-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }
        .pc-nav-menu-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 7px;
          color: var(--navy, #0f172a);
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pc-nav-divider {
          width: 1px;
          height: 24px;
          background: #e2e8f0;
          flex-shrink: 0;
        }
        .pc-nav-page {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow: hidden;
        }
        .pc-nav-page-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 1px solid #bbf7d0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .pc-nav-page-text {
          min-width: 0;
          overflow: hidden;
        }
        .pc-nav-page-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--navy, #0f172a);
          margin: 0;
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pc-nav-page-sub {
          font-size: 11px;
          color: var(--text-3, #94a3b8);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Right side ── */
        .pc-nav-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .pc-nav-icon-btn {
          position: relative;
          background: none;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-2, #475569);
          font-size: 15px;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .pc-nav-icon-btn:hover {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .pc-nav-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          font-size: 9px;
          font-weight: 800;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }

        /* ── Profile button ── */
        .pc-nav-profile-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          padding: 4px 8px 4px 4px;
          cursor: pointer;
          transition: all 0.15s;
          height: 36px;
          flex-shrink: 0;
        }
        .pc-nav-profile-btn:hover { background: #f8fafc; border-color: #e2e8f0; }
        .pc-nav-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
        }
        .pc-nav-profile-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--navy, #0f172a);
          white-space: nowrap;
          margin: 0;
        }
        .pc-nav-chevron {
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .pc-nav-chevron.open { transform: rotate(180deg); }

        /* ── Dropdown shared ── */
        .pc-nav-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06);
          border: 1px solid #f1f5f9;
          z-index: 200;
          overflow: hidden;
        }

        /* ── Dropdown items ── */
        .pc-notif-item  { transition: background 0.12s; cursor: pointer; }
        .pc-notif-item:hover  { background: #f8fafc !important; }
        .pc-profile-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: none;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          text-align: left;
          font-family: var(--font);
          font-size: 13px;
          transition: background 0.12s;
        }
        .pc-profile-item:hover { background: #f8fafc; }

        /* ── Mobile overrides ── */
        @media (max-width: 768px) {
          .pc-nav { padding: 0 14px; gap: 8px; }
          .pc-nav-menu-btn { display: flex !important; }
          .pc-nav-divider  { display: block; }
          .pc-nav-page-sub { display: none; }
          .pc-nav-profile-name { display: none; }
          .pc-nav-dropdown { right: -8px; }
          .pc-notif-dropdown { width: calc(100vw - 28px) !important; right: -8px; }
        }

        @media (max-width: 400px) {
          .pc-nav-page-icon { width: 28px; height: 28px; font-size: 12px; }
          .pc-nav-page-title { font-size: 13px; }
          .pc-nav-icon-btn { width: 32px; height: 32px; font-size: 13px; }
          .pc-nav-profile-btn { padding: 4px; }
        }
      `}</style>

      <header className="pc-nav">

        {/* ── Left ─────────────────────────────────────────────── */}
        <div className="pc-nav-left">
          <button className="pc-nav-menu-btn" onClick={onMenuOpen} aria-label="Open menu">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="pc-nav-divider" />

          <div className="pc-nav-page">
            <div className="pc-nav-page-icon">{meta.icon}</div>
            <div className="pc-nav-page-text">
              <p className="pc-nav-page-title">{meta.title}</p>
              {meta.sub && <p className="pc-nav-page-sub">{meta.sub}</p>}
            </div>
          </div>
        </div>

        {/* ── Right ────────────────────────────────────────────── */}
        <div className="pc-nav-right">

          {/* Notification bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="pc-nav-icon-btn"
              onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
              aria-label="Notifications"
            >
              🔔
              {unread > 0 && (
                <span className="pc-nav-badge">{unread > 9 ? '9+' : unread}</span>
              )}
            </button>

            {notifOpen && (
              <div className="pc-nav-dropdown pc-notif-dropdown" style={{ width: '310px' }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px 10px', borderBottom: '1px solid #f1f5f9',
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--navy, #0f172a)' }}>
                      Notifications
                    </p>
                    {unread > 0 && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3, #94a3b8)' }}>
                        {unread} unread
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', color: 'var(--accent, #22c55e)',
                        fontWeight: '600', fontFamily: 'var(--font)',
                        padding: '4px 8px', borderRadius: '6px',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className="pc-notif-item"
                      onClick={() => { markRead(n.id); if (n.path) navigate(n.path); setNotifOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 14px',
                        background: n.read ? 'transparent' : '#f0fdf4',
                        borderBottom: '1px solid #f8fafc',
                      }}
                    >
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '7px',
                        background: n.read ? '#f1f5f9' : '#dcfce7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', flexShrink: 0,
                      }}>
                        {NOTIF_ICONS[n.type] || '◎'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 2px', fontSize: '12px',
                          fontWeight: n.read ? '400' : '600',
                          color: 'var(--navy, #0f172a)', lineHeight: '1.4',
                        }}>
                          {n.message}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3, #94a3b8)' }}>
                          {timeAgo(n.time)}
                        </p>
                      </div>
                      {!n.read && (
                        <div style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: 'var(--accent, #22c55e)', flexShrink: 0, marginTop: '5px',
                        }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile button */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              className="pc-nav-profile-btn"
              onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
              aria-label="Profile menu"
            >
              <div className="pc-nav-avatar" style={{ background: roleColor }}>
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <p className="pc-nav-profile-name">
                {user?.name?.split(' ')[0] || 'Admin'}
              </p>
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                className={`pc-nav-chevron${profileOpen ? ' open' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {profileOpen && (
              <div className="pc-nav-dropdown" style={{ width: '210px' }}>
                {/* User info */}
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: roleColor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'white', fontWeight: '700',
                    fontSize: '14px', flexShrink: 0,
                  }}>
                    {user?.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--navy, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user?.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: roleColor, fontWeight: '600', textTransform: 'capitalize' }}>
                      {user?.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Menu items */}
                <div style={{ padding: '6px' }}>
                  {[
                    { icon: '◉', label: 'My Profile',   action: () => {},                    color: 'var(--navy, #0f172a)' },
                    { icon: '⊞', label: 'Preferences',  action: () => {},                    color: 'var(--navy, #0f172a)' },
                    { icon: '◐', label: 'Activity Log', action: () => navigate('/reports'),  color: 'var(--navy, #0f172a)' },
                  ].map(item => (
                    <button
                      key={item.label}
                      className="pc-profile-item"
                      onClick={() => { item.action(); setProfileOpen(false); }}
                      style={{ color: item.color, fontWeight: '500' }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--text-3, #94a3b8)', width: '16px', textAlign: 'center' }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Sign out */}
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px' }}>
                  <button
                    className="pc-profile-item"
                    onClick={handleLogout}
                    style={{ color: '#ef4444', fontWeight: '600' }}
                  >
                    <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>←</span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>
    </>
  );
};

export default Navbar;
