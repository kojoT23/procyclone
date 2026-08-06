import React from 'react';

export default function ComingSoon({ icon, title, description }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: '60px 32px', textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #d4af37, #b8860b)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1a1a18', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 360, margin: '0 auto' }}>{description}</p>
      <div style={{ marginTop: 20, display: 'inline-block', background: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>
        Coming soon
      </div>
    </div>
  );
}
