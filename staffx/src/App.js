import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import ClockInOut from './pages/ClockInOut';
import AttendanceHistory from './pages/AttendanceHistory';
import Scheduler from './pages/Scheduler';
import Payslips from './pages/Payslips';
import Leave from './pages/Leave';
import Career from './pages/Career';
import Documents from './pages/Documents';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute><AppShell><ClockInOut /></AppShell></PrivateRoute>
          } />

          <Route path="/attendance" element={
            <PrivateRoute><AppShell><AttendanceHistory /></AppShell></PrivateRoute>
          } />

          <Route path="/scheduler" element={
            <PrivateRoute><AppShell><Scheduler /></AppShell></PrivateRoute>
          } />

          <Route path="/payslips" element={
            <PrivateRoute><AppShell><Payslips /></AppShell></PrivateRoute>
          } />

          <Route path="/leave" element={
            <PrivateRoute><AppShell><Leave /></AppShell></PrivateRoute>
          } />

          <Route path="/career" element={
            <PrivateRoute><AppShell><Career /></AppShell></PrivateRoute>
          } />

          <Route path="/documents" element={
            <PrivateRoute><AppShell><Documents /></AppShell></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
