import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PortalLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/portal', label: 'Home', icon: '🏠', exact: true },
    { to: '/portal/deliveries', label: 'Deliveries', icon: '📦' },
    { to: '/portal/cash', label: 'Cash', icon: '💰' },
    { to: '/portal/messages', label: 'Messages', icon: '💬' },
    { to: '/portal/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f8', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Top bar */}
      <div style={{ background: '#1a1a18', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚲</div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0 }}>Shorewinds</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rider Portal</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0 }}>{user?.name}</p>
            <p style={{ color: '#22c55e', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
            Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #f3f4f6', display: 'flex', zIndex: 100, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px', textDecoration: 'none',
              color: isActive ? '#22c55e' : '#9ca3af',
              borderTop: isActive ? '2px solid #22c55e' : '2px solid transparent',
              background: 'none', transition: 'all 0.15s',
            })}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3, letterSpacing: '0.3px' }}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default PortalLayout;
