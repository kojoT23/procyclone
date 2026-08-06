import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/',            icon: '🏠', label: 'Home' },
  { to: '/attendance',  icon: '🕐', label: 'Attendance' },
  { to: '/scheduler',   icon: '📅', label: 'Scheduler' },
  { to: '/payslips',    icon: '💰', label: 'Payslips' },
  { to: '/leave',       icon: '🌴', label: 'Leave' },
  { to: '/career',      icon: '🎓', label: 'Career & Vacancies' },
  { to: '/documents',   icon: '📄', label: 'Documents' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const initials = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90, display: 'none' }}
          className="sidebar-overlay"
        />
      )}
      <aside
        className={`staffx-sidebar ${open ? 'open' : ''}`}
        style={{
          width: 240, background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
          color: '#fff', display: 'flex', flexDirection: 'column', height: '100vh',
          position: 'fixed', left: 0, top: 0, zIndex: 100,
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
            Staff<span style={{ color: '#d4af37' }}>X</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Shorewinds Workforce</div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10,
                marginBottom: 4, textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(212,175,55,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid #d4af37' : '3px solid transparent',
                transition: 'background 0.15s',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37, #b8860b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#1a1a18', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
