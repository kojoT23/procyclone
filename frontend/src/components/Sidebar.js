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
    { to: '/', label: 'Overview', icon: '◎', exact: true, permission: null },
    { to: '/orders', label: 'Orders', icon: '⊡', permission: 'manage_orders' },
    { to: '/customers', label: 'Customers', icon: '◉', permission: 'manage_customers' },
    { to: '/products', label: 'Products', icon: '⬡', permission: 'manage_products' },
    { to: '/inventory', label: 'Inventory', icon: '⊞', permission: 'manage_products' },
    { to: '/riders', label: 'Riders', icon: '⊕', permission: 'manage_riders' },
    { to: '/cash', label: 'Cash Control', icon: '◈', permission: 'manage_cash' },
    { to: '/payments', label: 'Payments', icon: '⊛', permission: 'manage_cash' },
    { to: '/reports', label: 'Reports', icon: '◐', permission: 'view_reports' },
    { to: '/receipts', label: 'Receipts', icon: '🧾', permission: null },
    { to: '/users', label: 'Staff', icon: '◑', permission: 'manage_users' },
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
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.6)',
            zIndex: 99, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div className={`sidebar${isOpen ? ' open' : ''}`}>
        {/* Logo */}
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
            }}>🚲</div>
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0, letterSpacing: '-0.3px' }}>ProCyclone</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sidebar-close"
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'rgba(255,255,255,0.6)', width: '28px', height: '28px',
              borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', marginBottom: '2px',
                borderRadius: '8px',
                color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                textDecoration: 'none', fontSize: '13.5px', fontWeight: isActive ? '600' : '400',
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', opacity: 0.8 }}>{link.icon}</span>
              {link.label}
              {link.to === '/orders' && (
                <span style={{
                  marginLeft: 'auto', background: '#22c55e', color: 'white',
                  fontSize: '10px', fontWeight: '700', padding: '1px 6px',
                  borderRadius: '10px', letterSpacing: '0.3px',
                }}>LIVE</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div style={{ padding: '12px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', marginBottom: '8px',
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: roleColor, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontWeight: '700',
                fontSize: '13px', flexShrink: 0,
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'white', margin: 0, fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
                <p style={{ color: roleColor, margin: 0, fontSize: '11px', textTransform: 'capitalize', fontWeight: '500' }}>{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '7px', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'var(--font)',
                fontWeight: '500', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              ← Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
