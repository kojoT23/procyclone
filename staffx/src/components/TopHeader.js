import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const getGreeting = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function TopHeader({ onMenuClick }) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #f0f0ee',
      padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuClick}
          className="staffx-menu-btn"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1a1a18' }}
        >
          ☰
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a18' }}>{getGreeting(now.getHours())}, {firstName} 👋</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {now.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </header>
  );
}
