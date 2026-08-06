import React from 'react';

const TransportComingSoon = ({ title, icon = '🚧' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1a1a18', margin: '0 0 6px' }}>{title}</h2>
    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>This page is coming soon.</p>
  </div>
);

export default TransportComingSoon;
