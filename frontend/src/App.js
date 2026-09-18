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
import Returns from './pages/Returns';
import PortalReturns from './pages/portal/PortalReturns';
import TransportReturns from './pages/portal/TransportReturns';
import Riders from './pages/Riders';
import Cash from './pages/Cash';
import Staff from './pages/Staff';
import Inventory from './pages/Inventory';
import Payments from './pages/Payments';
import ReportsHub from './pages/ReportsHub';
import Receipts from './pages/Receipts';
import Billing from './pages/Billing';
import MassOrder from './pages/MassOrder';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import DeliveryBoard from './pages/DeliveryBoard';
import Scheduler from './pages/Scheduler';
import Settlements from './pages/Settlements';
import './App.css';
import Profile   from './pages/Profile';
import Expenses from './pages/Expenses';
import ImportShipments from './pages/ImportShipments';
import RBAC from './pages/RBAC';
import PortalLayout from './pages/portal/PortalLayout';
import PortalHome from './pages/portal/PortalHome';
import PortalCash from './pages/portal/PortalCash';
import PortalProfile from './pages/portal/PortalProfile';
import PortalMessages from './pages/portal/PortalMessages';
import PortalDeliveries from './pages/portal/PortalDeliveries';
import PortalSchedule from './pages/portal/PortalSchedule';
import PortalComingSoon from './pages/portal/PortalComingSoon';
import PortalOrders from './pages/portal/PortalOrders';
import PortalRiders from './pages/portal/PortalRiders';
import PortalCashAdmin from './pages/portal/PortalCashAdmin';
import PortalBilling from './pages/portal/PortalBilling';
import AuditLog  from './pages/AuditLog';

// TransportLayout enforces the role gate itself (customer_support,
// manager, admin, super_admin) — every /transport/* page below is a
// real, finished component now.
import TransportLayout from './pages/portal/TransportLayout';
import TransportHome from './pages/portal/TransportHome';
import TransportDeliveries from './pages/portal/TransportDeliveries';
import TransportCash from './pages/portal/TransportCash';
import TransportMessages from './pages/portal/TransportMessages';
import TransportProfile from './pages/portal/TransportProfile';
import TransportBilling from './pages/portal/TransportBilling';
import TransportOrderLookup from './pages/portal/TransportOrderLookup';
import TransportSchedule from './pages/portal/TransportSchedule';
import TransportProducts from './pages/portal/TransportProducts';
import TransportInventory from './pages/portal/TransportInventory';
import TransportMassOrder from './pages/portal/TransportMassOrder';


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
          <Route path="/returns" element={<PrivateRoute><Layout><Returns /></Layout></PrivateRoute>} />
          <Route path="/products" element={<PrivateRoute><Layout><Products /></Layout></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><Layout><Inventory /></Layout></PrivateRoute>} />
          <Route path="/riders" element={<PrivateRoute><Layout><Riders /></Layout></PrivateRoute>} />
          <Route path="/cash" element={<PrivateRoute><Layout><Cash /></Layout></PrivateRoute>} />
          <Route path="/payments" element={<PrivateRoute><Layout><Payments /></Layout></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Layout><ReportsHub /></Layout></PrivateRoute>} />
          <Route path="/receipts" element={<PrivateRoute><Layout><Receipts /></Layout></PrivateRoute>} />
          <Route path="/billing" element={<PrivateRoute><Layout><Billing /></Layout></PrivateRoute>} />
          <Route path="/billing/mass-order" element={<PrivateRoute><Layout><MassOrder /></Layout></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Layout><Staff /></Layout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><Layout><Chat /></Layout></PrivateRoute>} />
          <Route path="/delivery" element={<PrivateRoute><Layout><DeliveryBoard /></Layout></PrivateRoute>} />
          <Route path="/scheduler" element={<PrivateRoute><Layout><Scheduler /></Layout></PrivateRoute>} />
          <Route path="/settlements" element={<PrivateRoute><Layout><Settlements /></Layout></PrivateRoute>} />   
          <Route path="/profile"   element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
          <Route path="/expenses" element={<PrivateRoute><Layout><Expenses /></Layout></PrivateRoute>} />
          <Route path="/imports" element={<PrivateRoute><Layout><ImportShipments /></Layout></PrivateRoute>} />
          <Route path="/rbac" element={<PrivateRoute><Layout><RBAC /></Layout></PrivateRoute>} />
          <Route path="/portal" element={<PrivateRoute><PortalLayout><PortalHome /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/cash" element={<PrivateRoute><PortalLayout><PortalCash /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/deliveries" element={<PrivateRoute><PortalLayout><PortalDeliveries /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/schedule" element={<PrivateRoute><PortalLayout><PortalSchedule /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/messages" element={<PrivateRoute><PortalLayout><PortalMessages /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/returns" element={<PrivateRoute><PortalLayout><PortalReturns /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/profile" element={<PrivateRoute><PortalLayout><PortalProfile /></PortalLayout></PrivateRoute>} />

          {/* ── Staff portal routes (super_admin / admin / manager) ──
              Not yet built for mobile — placeholder until each page
              gets its own real component. Swap the element on each
              line as it's built; no other file needs to change. ── */}
          <Route path="/portal/orders" element={<PrivateRoute><PortalLayout><PortalOrders /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/riders" element={<PrivateRoute><PortalLayout><PortalRiders /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/cash-admin" element={<PrivateRoute><PortalLayout><PortalCashAdmin /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/settlements" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Settlements" icon="🧮" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/receipts" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Receipts" icon="🖨️" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/payments" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Payments" icon="💳" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/expenses" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Expenses" icon="📉" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/reports" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Reports" icon="📊" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/customers" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Customers" icon="🧑‍🤝‍🧑" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/staff" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Staff" icon="🧑‍💼" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/rbac" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Roles & Access" icon="🔐" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/products" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Products" icon="🛍️" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/inventory" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Inventory" icon="📦" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/delivery-board" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Delivery Board" icon="🗺️" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/audit-log" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Audit Log" icon="📜" /></PortalLayout></PrivateRoute>} />
          <Route path="/portal/settings" element={<PrivateRoute><PortalLayout><PortalComingSoon title="Settings" icon="⚙️" /></PortalLayout></PrivateRoute>} />

          <Route path="/portal/billing" element={<PrivateRoute><PortalLayout><PortalBilling /></PortalLayout></PrivateRoute>} />
          <Route path="/audit-log" element={<PrivateRoute><Layout><AuditLog /></Layout></PrivateRoute>} />  

          {/* ── Transport Portal (support staff, + manager/admin/super_admin
              assisting) — TransportLayout enforces the role gate itself. ── */}
          <Route path="/transport" element={<PrivateRoute><TransportLayout><TransportHome /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/deliveries" element={<PrivateRoute><TransportLayout><TransportDeliveries /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/cash" element={<PrivateRoute><TransportLayout><TransportCash /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/messages" element={<PrivateRoute><TransportLayout><TransportMessages /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/returns" element={<PrivateRoute><TransportLayout><TransportReturns /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/profile" element={<PrivateRoute><TransportLayout><TransportProfile /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/billing" element={<PrivateRoute><TransportLayout><TransportBilling /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/mass-order" element={<PrivateRoute><TransportLayout><TransportMassOrder /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/orders" element={<PrivateRoute><TransportLayout><TransportOrderLookup /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/schedule" element={<PrivateRoute><TransportLayout><TransportSchedule /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/products" element={<PrivateRoute><TransportLayout><TransportProducts /></TransportLayout></PrivateRoute>} />
          <Route path="/transport/inventory" element={<PrivateRoute><TransportLayout><TransportInventory /></TransportLayout></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
