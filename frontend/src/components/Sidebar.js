import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleColors = {
    super_admin: '#ef4444', admin: '#f59e0b', manager: '#3b82f6',
    cashier: '#22c55e', dispatcher: '#8b5cf6', warehouse: '#14b8a6', rider: '#f97316',
  };
  const roleColor = roleColors[user?.role] || '#94a3b8';

  /* ── Permission helper ────────────────────────────────────────── */
  const can = (permission) => {
    if (permission === null) return true;
    if (permission === 'super_admin_only') return user?.role === 'super_admin';
    return hasPermission && hasPermission(permission);
  };

  /* ── Nav groups ───────────────────────────────────────────────── */
  const groups = [
    {
      key:   'operations',
      label: 'Operations',
      icon:  '⚡',
      links: [
        { to: '/',        label: 'Overview',  icon: '◎', exact: true, permission: null },
        { to: '/orders',  label: 'Orders',    icon: '⊡', permission: 'manage_orders', badge: 'LIVE' },
        { to: '/billing', label: 'New Bill',  icon: '💳', permission: null },
        { to: '/receipts',label: 'Receipts',  icon: '🧾', permission: null },
        { to: '/delivery',label: 'Delivery',  icon: '🏍️', permission: 'manage_riders' },
        { to: '/scheduler', label: 'Scheduler', icon: '📅', permission: 'manage_riders' },
      ],
    },
    {
      key:   'people',
      label: 'People',
      icon:  '👥',
      links: [
        { to: '/customers', label: 'Customers', icon: '◉', permission: 'manage_customers' },
        { to: '/riders',    label: 'Riders',    icon: '⊕', permission: 'manage_riders' },
        { to: '/users',     label: 'Staff',     icon: '◑', permission: 'manage_users' },
      ],
    },
    {
      key:   'inventory',
      label: 'Inventory',
      icon:  '📦',
      links: [
        { to: '/products',  label: 'Products',  icon: '⬡', permission: 'manage_products' },
        { to: '/inventory', label: 'Inventory', icon: '⊞', permission: 'manage_products' },
      ],
    },
    {
      key:   'finance',
      label: 'Finance',
      icon:  '💰',
      links: [
        { to: '/cash',     label: 'Cash Control', icon: '◈', permission: 'manage_cash' },
        { to: '/payments', label: 'Payments',     icon: '⊛', permission: 'manage_cash' },
        { to: '/reports',  label: 'Reports',      icon: '◐', permission: 'view_reports' },
        { to: '/expenses', label: 'Expenses',     icon: '💸', permission: 'manage_cash' },
        { to: '/settlements', label: 'Settlements', icon: '🤝', permission: 'manage_cash' },
        { to: '/imports', label: 'Imports', icon: '📦', permission: 'manage_expenses' },
      ],
    },
    {
      key:   'system',
      label: 'System',
      icon:  '⚙️',
      links: [
        { to: '/chat',      label: 'Messages',  icon: '💬', permission: null },
        { to: '/settings',  label: 'Settings',  icon: '⚙️', permission: null },
        { to: '/portal', label: 'My Portal', icon: '📱', permission: 'super_admin_only' },
        { to: '/portal?view_as=rider', label: 'Rider Portal', icon: '🛵', permission: 'super_admin_only' },
        { to: '/portal?view_as=cashier', label: 'Cashier Portal', icon: '💵', permission: 'super_admin_only' },
        { to: '/portal?view_as=dispatcher', label: 'Dispatcher Portal', icon: '📡', permission: 'super_admin_only' },
        { to: '/portal?view_as=warehouse', label: 'Warehouse Portal', icon: '📦', permission: 'super_admin_only' },
        { to: '/portal?view_as=manager', label: 'Manager Portal', icon: '🗂️', permission: 'super_admin_only' },
        { to: '/portal?view_as=admin', label: 'Admin Portal', icon: '🛡️', permission: 'super_admin_only' },
        { to: '/rbac', label: 'Permissions', icon: '🔐', permission: 'super_admin_only' },
        { to: '/audit-log', label: 'Audit Log', icon: '📋', permission: 'super_admin_only' },
      ],
    },
  ];

  /* ── Default open groups — whichever contains the active route ── */
  const activeGroup = groups.find(g => g.links.some(l => l.to === location.pathname))?.key;
  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = new Set(['operations']);
    if (activeGroup) defaults.add(activeGroup);
    return defaults;
  });

  const toggleGroup = (key) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <>
      <style>{`
        /* ── Nav link ─────────────────────────────── */
        .sb-link {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px 8px 28px;
          margin-bottom: 1px;
          border-radius: 7px;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          font-size: 13px; font-weight: 400;
          font-family: var(--font);
          background: transparent;
          transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
          position: relative; overflow: hidden;
        }
        .sb-link:hover {
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.06);
        }
        .sb-link:hover .sb-icon { transform: scale(1.15); opacity: 1; }
        .sb-link::before {
          content: '';
          position: absolute; left: 0; top: 20%; bottom: 20%;
          width: 3px; border-radius: 0 3px 3px 0;
          background: #22c55e;
          transform: translateX(-4px); opacity: 0;
          transition: all 0.18s ease;
        }
        .sb-link:hover::before { transform: translateX(0); opacity: 0.6; }
        .sb-link.active {
          color: white; font-weight: 600;
          background: rgba(255,255,255,0.09);
        }
        .sb-link.active::before { transform: translateX(0); opacity: 1; }
        .sb-link.active .sb-icon { opacity: 1; }

        /* ── Icon ─────────────────────────────────── */
        .sb-icon {
          font-size: 14px; width: 18px; text-align: center;
          opacity: 0.65; flex-shrink: 0;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Group header ─────────────────────────── */
        .sb-group-header {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; margin: 4px 0 2px;
          border-radius: 6px;
          color: rgba(255,255,255,0.25);
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.8px;
          cursor: pointer; user-select: none;
          transition: all 0.15s;
          background: transparent; border: none; width: 100%;
          font-family: var(--font);
        }
        .sb-group-header:hover {
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.04);
        }
        .sb-group-chevron {
          margin-left: auto;
          font-size: 9px;
          opacity: 0.4;
          transition: transform 0.2s ease;
        }
        .sb-group-chevron.open { transform: rotate(180deg); }

        /* ── Group links container ────────────────── */
        .sb-group-links {
          overflow: hidden;
          transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1),
                      opacity 0.2s ease;
        }
        .sb-group-links.open { max-height: 1000px; opacity: 1; }
        .sb-group-links.closed { max-height: 0; opacity: 0; }

        /* ── Scrollable nav ───────────────────────── */
        .sb-nav {
          flex: 1;
          padding: 10px 8px;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
        }
        /* Thin scrollbar */
        .sb-nav::-webkit-scrollbar { width: 3px; }
        .sb-nav::-webkit-scrollbar-track { background: transparent; }
        .sb-nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 3px;
        }
        /* Fade out at bottom */
        .sb-nav-wrap {
          position: relative; flex: 1; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .sb-nav-wrap::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 32px;
          background: linear-gradient(to bottom, transparent, var(--navy, #0f172a));
          pointer-events: none;
          z-index: 1;
        }

        /* ── Sign out ─────────────────────────────── */
        .sb-signout {
          width: 100%; padding: 8px 12px;
          background: transparent;
          color: rgba(255,255,255,0.3);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 7px; cursor: pointer;
          font-size: 12px; font-family: var(--font); font-weight: 500;
          transition: all 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .sb-signout:hover {
          color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.12);
        }

        /* ── User card ────────────────────────────── */
        .sb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.05);
          margin-bottom: 8px; transition: background 0.15s;
          cursor: pointer;
        }
        .sb-user:hover { background: rgba(255,255,255,0.08); }

        /* ── Divider ──────────────────────────────── */
        .sb-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 4px 10px;
        }
      `}</style>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            zIndex: 99,
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        />
      )}

      <div className={`sidebar${isOpen ? ' open' : ''}`} style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Logo ──────────────────────────────────────────── */}
        <div style={{
          padding: '18px 18px 14px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
            }}>🚲</div>
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0, letterSpacing: '-0.3px' }}>
                Shorewinds
              </p>
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sidebar-close"
            style={{
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'rgba(255,255,255,0.5)',
              width: '28px', height: '28px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >✕</button>
        </div>

        {/* ── Nav with fade ─────────────────────────────────── */}
        <div className="sb-nav-wrap">
          <nav className="sb-nav">
            {groups.map((group, gi) => {
              // Filter links by permission
              const visibleLinks = group.links.filter(l => can(l.permission));
              if (!visibleLinks.length) return null;

              const isOpen_ = openGroups.has(group.key);

              return (
                <div key={group.key}>
                  {gi > 0 && <div className="sb-divider" />}

                  {/* Group header */}
                  <button className="sb-group-header" onClick={() => toggleGroup(group.key)}>
                    <span style={{ fontSize: '11px' }}>{group.icon}</span>
                    {group.label}
                    <span className={`sb-group-chevron${isOpen_ ? ' open' : ''}`}>▼</span>
                  </button>

                  {/* Group links */}
                  <div className={`sb-group-links${isOpen_ ? ' open' : ' closed'}`}>
                    {visibleLinks.map(link => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.exact}
                        onClick={onClose}
                        className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`}
                      >
                        <span className="sb-icon">{link.icon}</span>
                        {link.label}
                        {link.badge && (
                          <span style={{
                            marginLeft: 'auto',
                            background: '#22c55e', color: 'white',
                            fontSize: '8px', fontWeight: '700',
                            padding: '2px 5px', borderRadius: '8px',
                            letterSpacing: '0.4px',
                          }}>
                            {link.badge}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Bottom padding so last items clear the fade */}
            <div style={{ height: '36px' }} />
          </nav>
        </div>

        {/* ── User ──────────────────────────────────────────── */}
        {user && (
          <div style={{ padding: '10px 8px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div className="sb-user" onClick={() => { navigate('/profile'); onClose(); }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: roleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0,
                boxShadow: `0 2px 6px ${roleColor}55`,
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: 'white', margin: 0, fontSize: '13px', fontWeight: '600',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user?.name}
                </p>
                <p style={{ color: roleColor, margin: 0, fontSize: '11px', textTransform: 'capitalize', fontWeight: '500' }}>
                  {user?.role?.replace('_', ' ')}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.22)', margin: '1px 0 0', fontSize: '10px' }}>
                  View profile →
                </p>
              </div>
            </div>
            <button className="sb-signout" onClick={handleLogout}>
              ← Sign out
            </button>
          </div>
        )}

      </div>
    </>
  );
};

export default Sidebar;
