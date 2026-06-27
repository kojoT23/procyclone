import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Riders from './pages/Riders';
import Cash from './pages/Cash';
import Staff from './pages/Staff';
import Inventory from './pages/Inventory';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Receipts from './pages/Receipts';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import DeliveryBoard from './pages/DeliveryBoard';
import Settlements from './pages/Settlements';
import './App.css';
import Profile   from './pages/Profile';
import Expenses from './pages/Expenses';
import RBAC from './pages/RBAC';
import PortalLayout from './pages/portal/PortalLayout';
import PortalHome from './pages/portal/PortalHome';
import PortalCash from './pages/portal/PortalCash';
import PortalProfile from './pages/portal/PortalProfile';
import PortalMessages from './pages/portal/PortalMessages';
import PortalDeliveries from './pages/portal/PortalDeliveries';
import AuditLog  from './pages/AuditLog';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar onMenuOpen={() => setSidebarOpen(true)} />
        <div style={{ padding: '28px 32px 56px', width: '100%', boxSizing: 'border-box' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/orders" element={<PrivateRoute><Layout><Orders /></Layout></PrivateRoute>} />
          <Route path="/customers" element={<PrivateRoute><Layout><Customers /></Layout></PrivateRoute>} />
          <Route path="/products" element={<PrivateRoute><Layout><Products /></Layout></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><Layout><Inventory /></Layout></PrivateRoute>} />
          <Route path="/riders" element={<PrivateRoute><Layout><Riders /></Layout></PrivateRoute>} />
          <Route path="/cash" element={<PrivateRoute><Layout><Cash /></Layout></PrivateRoute>} />
          <Route path="/payments" element={<PrivateRoute><Layout><Payments /></Layout></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Layout><Reports /></Layout></PrivateRoute>} />
          <Route path="/receipts" element={<PrivateRoute><Layout><Receipts /></Layout></PrivateRoute>} />
          <Route path="/billing" element={<PrivateRoute><Layout><Billing /></Layout></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Layout><Staff /></Layout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><Layout><Chat /></Layout></PrivateRoute>} />
          <Route path="/delivery" element={<PrivateRoute><Layout><DeliveryBoard /></Layout></PrivateRoute>} />
          <Route path="/settlements" element={<PrivateRoute><Layout><Settlements /></Layout></PrivateRoute>} />   
          <Route path="/profile"   element={<Profile />} />
          <Route path="/expenses" element={<PrivateRoute><Layout><Expenses /></Layout></PrivateRoute>} />
          <Route path="/rbac" element={<PrivateRoute><Layout><RBAC /></Layout></PrivateRoute>} />
          <Route path="/portal" element={<PrivateRoute><PortalLayout><PortalHome /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/cash" element={<PrivateRoute><PortalLayout><PortalCash /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/deliveries" element={<PrivateRoute><PortalLayout><PortalDeliveries /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/messages" element={<PrivateRoute><PortalLayout><PortalMessages /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/profile" element={<PrivateRoute><PortalLayout><PortalProfile /></PortalLayout></PrivateRoute>} />
          <Route path="/audit-log" element={<PrivateRoute><Layout><AuditLog /></Layout></PrivateRoute>} />  
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
