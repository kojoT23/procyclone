import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allLinks = [
    { to: '/',          label: 'Overview',     icon: '◎', exact: true, permission: null },
    { to: '/orders',    label: 'Orders',        icon: '⊡', permission: 'manage_orders' },
    { to: '/customers', label: 'Customers',     icon: '◉', permission: 'manage_customers' },
    { to: '/products',  label: 'Products',      icon: '⬡', permission: 'manage_products' },
    { to: '/inventory', label: 'Inventory',     icon: '⊞', permission: 'manage_products' },
    { to: '/riders',    label: 'Riders',        icon: '⊕', permission: 'manage_riders' },
    { to: '/cash',      label: 'Cash Control',  icon: '◈', permission: 'manage_cash' },
    { to: '/payments',  label: 'Payments',      icon: '⊛', permission: 'manage_cash' },
    { to: '/reports',   label: 'Reports',       icon: '◐', permission: 'view_reports' },
    { to: '/billing',   label: 'New Bill',      icon: '💳', permission: null },
    { to: '/receipts',  label: 'Receipts',      icon: '🧾', permission: null },
    { to: '/users',     label: 'Staff',         icon: '◑', permission: 'manage_users' },
    { to: '/delivery',  label: 'Delivery Board', icon: '🏍️', permission: 'manage_riders' },
    { to: '/settings',  label: 'Settings',      icon: '⚙️', permission: null },
  ];

  const links = allLinks.filter(link =>
    link.permission === null || (hasPermission && hasPermission(link.permission))
  );

  const roleColors = {
    super_admin: '#ef4444', admin: '#f59e0b', manager: '#3b82f6',
    cashier: '#22c55e', dispatcher: '#8b5cf6', warehouse: '#14b8a6', rider: '#f97316',
  };

  const roleColor = roleColors[user?.role] || '#94a3b8';

  return (
    <>
      <style>{`
        /* ── Nav link base ── */
        .sb-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          margin-bottom: 2px;
          border-radius: 8px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 400;
          font-family: var(--font);
          background: transparent;
          transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
          position: relative;
          overflow: hidden;
        }

        /* Hover state */
        .sb-link:hover {
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.07);
        }

        /* Hover — icon scale */
        .sb-link:hover .sb-icon {
          transform: scale(1.18);
          opacity: 1;
        }

        /* Hover — left accent bar slides in */
        .sb-link::before {
          content: '';
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: #22c55e;
          transform: translateX(-4px);
          opacity: 0;
          transition: all 0.18s ease;
        }

        .sb-link:hover::before {
          transform: translateX(0);
          opacity: 0.7;
        }

        /* Active state */
        .sb-link.active {
          color: white;
          font-weight: 600;
          background: rgba(255,255,255,0.1);
        }

        .sb-link.active::before {
          transform: translateX(0);
          opacity: 1;
        }

        .sb-link.active .sb-icon {
          opacity: 1;
        }

        /* Icon */
        .sb-icon {
          font-size: 15px;
          width: 20px;
          text-align: center;
          opacity: 0.7;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Sign out button */
        .sb-signout {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          color: rgba(255,255,255,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 7px;
          cursor: pointer;
          font-size: 12px;
          font-family: var(--font);
          font-weight: 500;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .sb-signout:hover {
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.15);
        }

        /* User card */
        .sb-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          margin-bottom: 8px;
          transition: background 0.15s;
        }

        .sb-user:hover {
          background: rgba(255,255,255,0.08);
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

      <div className={`sidebar${isOpen ? ' open' : ''}`}>

        {/* ── Logo ─────────────────────────────────────────── */}
        <div style={{
          padding: '20px 20px 16px',
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
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              width: '28px', height: '28px',
              borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >✕</button>
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              onClick={onClose}
              className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`}
            >
              <span className="sb-icon">{link.icon}</span>
              {link.label}
              {link.to === '/orders' && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#22c55e',
                  color: 'white',
                  fontSize: '9px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  letterSpacing: '0.4px',
                }}>
                  LIVE
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── User ─────────────────────────────────────────── */}
        {user && (
          <div style={{ padding: '12px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="sb-user">
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
                <p style={{
                  color: roleColor, margin: 0, fontSize: '11px',
                  textTransform: 'capitalize', fontWeight: '500',
                }}>
                  {user?.role?.replace('_', ' ')}
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
