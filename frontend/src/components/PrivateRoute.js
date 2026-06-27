import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  // Riders can only access /portal routes
  const isPortalRoute = location.pathname.startsWith('/portal');
  if (user.role === 'rider' && !isPortalRoute) return <Navigate to="/portal" />;

  // Non-riders trying to access portal — allow only super_admin
  if (isPortalRoute && user.role !== 'rider' && user.role !== 'super_admin' && user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

export default PrivateRoute;
