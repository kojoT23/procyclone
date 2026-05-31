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
    { to: '/', label: 'Overview', icon: '📊', exact: true, permission: null },
    { to: '/orders', label: 'Orders', icon: '🛍️', permission: 'manage_orders' },
    { to: '/customers', label: 'Customers', icon: '👥', permission: 'manage_customers' },
    { to: '/products', label: 'Products', icon: '📦', permission: 'manage_products' },
    { to: '/riders', label: 'Riders', icon: '🏍️', permission: 'manage_riders' },
    { to: '/cash', label: 'Cash Control', icon: '💰', permission: 'manage_cash' },
    { to: '/users', label: 'Staff', icon: '👤', permission: 'manage_users' },
  ];

  const links = allLinks.filter(link =>
    link.permission === null || (hasPermission && hasPermission(link.permission))
  );

  const roleColors = {
    super_admin: '#e74c3c', admin: '#e67e22', manager: '#3498db',
    cashier: '#2ecc71', dispatcher: '#9b59b6', warehouse: '#1abc9c', rider: '#f39c12',
  };

  const roleColor = roleColors[user?.role] || '#666';

  return (
    <>
      {/* Dark overlay on mobile when sidebar open */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          width: '240px',
          minHeight: '100vh',
          background: '#1a1a2e',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0, top: 0,
          zIndex: 100,
          transform: isOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.3s ease',
        }}
        className={`sidebar${isOpen ? ' open' : ''}`}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', margin: '0 0 2px', fontSize: '18px', fontWeight: 'bold' }}>ProCyclone</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '11px' }}>Business Dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="sidebar-close"
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 20px',
                color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                textDecoration: 'none', fontSize: '14px',
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid #4CAF50' : '3px solid transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: roleColor, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px',
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ color: 'white', margin: 0, fontSize: '13px', fontWeight: '500' }}>{user?.name}</p>
                <p style={{ color: roleColor, margin: 0, fontSize: '11px', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '8px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
