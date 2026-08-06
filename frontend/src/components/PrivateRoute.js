import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* Mobile = narrow viewport, full stop. Resizing a browser window
   below this width — on a phone or a laptop — sends staff to the
   portal instead of the desktop dashboard. */
const MOBILE_BREAKPOINT = 768;

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  const isPortalRoute = location.pathname.startsWith('/portal');
  const staffRoles = ['super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse'];

  // Riders can only access /portal routes
  if (user.role === 'rider' && !isPortalRoute) return <Navigate to="/portal" />;

  // Staff on a narrow screen, with portal access granted, get sent
  // straight to the portal too — the full dashboard isn't a great
  // experience on a small screen, so default them to the mobile
  // view. They can still reach the dashboard from a wider window.
  if (
    !isPortalRoute &&
    staffRoles.includes(user.role) &&
    user.portal_access &&
    isMobileDevice()
  ) {
    return <Navigate to="/portal" />;
  }

  // Staff trying to reach the portal need both an eligible role AND
  // an explicit grant (user.portal_access, set via Settings → Portal
  // Access). Riders are exempt — their own data access is already
  // gated separately via riders.user_id inside the portal itself.
  if (isPortalRoute && user.role !== 'rider') {
    if (!staffRoles.includes(user.role)) {
      return <Navigate to="/" />;
    }
    if (!user.portal_access) {
      return <Navigate to="/" />;
    }
  }

  return children;
};

export default PrivateRoute;
