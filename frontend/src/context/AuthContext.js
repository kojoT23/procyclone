import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

const rolePermissions = {
  super_admin: ['manage_users','manage_products','manage_orders','manage_customers','manage_riders','manage_cash','manage_expenses','view_reports','manage_settings','delete_records'],
  admin: ['manage_users','manage_products','manage_orders','manage_customers','manage_riders','manage_cash','manage_expenses','view_reports','delete_records'],
  manager: ['manage_products','manage_orders','manage_customers','manage_riders','manage_expenses','view_reports'],
  cashier: ['manage_orders','manage_customers','manage_cash'],
  dispatcher: ['manage_orders','manage_riders'],
  warehouse: ['manage_products'],
  rider: ['manage_cash'],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (accessToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  // localStorage is shared across every tab in the same browser. On a
  // shared device, if Person A leaves a tab open and Person B logs in
  // on a NEW tab, Person B's login overwrites the shared accessToken —
  // Person A's tab has no way to know, and on its next request it
  // silently starts acting as Person B. The 'storage' event only fires
  // in OTHER tabs (never the one that made the change), which is
  // exactly what's needed here: the moment any other tab changes the
  // login state, force this tab to reload so it can never keep
  // operating under a now-stale identity.
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'accessToken' || e.key === 'user' || e.key === null) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { accessToken, refreshToken, user } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return response.data;
  };

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles) => {
    return user ? roles.includes(user.role) : false;
  }, [user]);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    const perms = rolePermissions[user.role] || [];
    return perms.includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
