import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import StaffDashboard from './StaffDashboard';

const NotFound = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f9fafb', textAlign: 'center', fontFamily: 'inherit' }}>
    <div style={{ maxWidth: 360 }}>
      <div style={{ fontSize: 56 }}>🧭</div>
      <h1 style={{ margin: '8px 0 6px', fontSize: 26 }}>Page not found</h1>
      <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
        We couldn't find that page. It may have moved, or the link might be mistyped.
      </p>
      <a href="/" style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 10, background: '#111827', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
        Back to the store
      </a>
    </div>
  </div>
);

const path = window.location.pathname;
const isStaffRoute = path.startsWith('/staff');
const isStorefrontRoute = path === '/' || path === '/index.html';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isStaffRoute ? <StaffDashboard /> : isStorefrontRoute ? <App /> : <NotFound />}
  </React.StrictMode>
);
