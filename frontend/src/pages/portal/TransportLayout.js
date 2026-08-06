import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Primary role this portal is built for, plus the roles allowed to step in
// and help out. Enforced here in the shared layout so every /transport/*
// page is covered without touching individual route files.
// NOTE: this is a UX gate only — the backend must independently reject
// these API calls for any role not in this list, since a frontend check
// alone can be bypassed by calling the API directly.
const TRANSPORT_PRIMARY_ROLE = 'customer_support';
const TRANSPORT_ALLOWED_ROLES = ['customer_support', 'manager', 'admin', 'super_admin'];

const TransportLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  if (!TRANSPORT_ALLOWED_ROLES.includes(user?.role)) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: 480, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a18', margin: '0 0 6px' }}>Transport Portal</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
          This portal is only available to Support Staff, and Managers/Admins assisting them.
        </p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isAssisting = user?.role !== TRANSPORT_PRIMARY_ROLE;

  const navItems = [
    { to: '/transport', label: 'Home', icon: '🏠', exact: true },
    { to: '/transport/deliveries', label: 'Deliveries', icon: '📦' },
    { to: '/transport/cash', label: 'Cash', icon: '💰' },
    { to: '/transport/messages', label: 'Messages', icon: '💬' },
  ];

  // Items surfaced inside the "More" sheet. Split into two groups:
  // the new sales-agent tools up top, existing utility links below.
  const moreItemsPrimary = [
    { to: '/transport/billing', label: 'New Sale', icon: '🧾', desc: 'Create an order for a customer' },
    { to: '/transport/mass-order', label: 'Mass Order', icon: '📦', desc: 'Same order for many customers at once' },
    { to: '/transport/orders', label: 'Find Order', icon: '📋', desc: "Search any order — even another agent's sale" },
    { to: '/transport/schedule', label: 'Schedule', icon: '📅', desc: "View any rider's tasks for the day" },
    { to: '/transport/products', label: 'Stock', icon: '🔍', desc: 'Check prices & stock levels' },
    { to: '/transport/inventory', label: 'Inventory', icon: '📊', desc: 'My activity & report damage/loss' },
  ];
  const moreItemsSecondary = [
    { to: '/transport/profile', label: 'Profile', icon: '👤' },
  ];

  const goTo = (path) => { setShowMore(false); navigate(path); };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f8', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <div style={{ background: '#1a1a18', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚲</div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0 }}>Shorewinds</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transport Portal</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0 }}>{user?.name}</p>
              {isAssisting && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#1a1a18', background: '#22c55e', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Assist
                </span>
              )}
            </div>
            <p style={{ color: '#22c55e', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Out</button>
        </div>
      </div>

      {isAssisting && (
        <div style={{ background: '#fffbeb', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>You're assisting in Transport Portal</span>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#1a1a18', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #f3f4f6', display: 'flex', zIndex: 100, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 8px', textDecoration: 'none',
            color: isActive ? '#22c55e' : '#9ca3af',
            borderTop: isActive ? '2px solid #22c55e' : '2px solid transparent',
            transition: 'all 0.15s',
          })}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3 }}>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 8px', background: 'none', border: 'none', cursor: 'pointer',
            color: showMore ? '#22c55e' : '#9ca3af',
            borderTop: showMore ? '2px solid #22c55e' : '2px solid transparent',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>⋯</span>
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3 }}>More</span>
        </button>
      </div>

      {/* "More" bottom sheet */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, background: '#fff',
              borderRadius: '20px 20px 0 0', padding: '10px 16px 24px',
              animation: 'transport-sheet-up 0.18s ease-out',
            }}
          >
            <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '4px auto 14px' }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 4px 10px' }}>
              Sales & Stock
            </p>
            {moreItemsPrimary.map(item => (
              <button
                key={item.to}
                onClick={() => goTo(item.to)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 8px', background: 'none', border: 'none',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.desc}</div>
                </div>
              </button>
            ))}
            <div style={{ height: 1, background: '#f3f4f6', margin: '10px 4px' }} />
            {moreItemsSecondary.map(item => (
              <button
                key={item.to}
                onClick={() => goTo(item.to)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 8px', background: 'none', border: 'none',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18, width: 40, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowMore(false)}
              style={{ width: '100%', marginTop: 12, padding: '12px 0', background: '#f9f9f8', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes transport-sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TransportLayout;
