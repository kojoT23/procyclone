import React from 'react';

/* Generic "not built yet" placeholder so every nav item in
   PortalLayout's role configs resolves to a real route — clicking
   shows a clear status instead of silently bouncing to "/". Swap
   this out page-by-page as each portal screen gets built for real;
   nothing else needs to change when that happens. */
export default function PortalComingSoon({ title = 'This page', icon = '🛠️' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ color: '#1a1a18', margin: '0 0 8px' }}>{title} is coming to the portal</h3>
      <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 280, margin: '0 auto' }}>
        This section isn't built for mobile yet. For now, use the full dashboard on a desktop browser.
      </p>
    </div>
  );
}
