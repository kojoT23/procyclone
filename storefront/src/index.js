import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import StaffDashboard from './StaffDashboard';

const isStaffRoute = window.location.pathname.startsWith('/staff');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isStaffRoute ? <StaffDashboard /> : <App />}
  </React.StrictMode>
);
