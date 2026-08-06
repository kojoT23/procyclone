import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ═══════════════════════════════════════════════════════════════
   ROLE → NAV CONFIG
   Each role gets up to 4 fixed bottom-nav items + a "More" grid
   for everything else. Rider's config is unchanged from before —
   only staff roles (super_admin/admin/manager) are new.
═══════════════════════════════════════════════════════════════ */
const ROLE_NAV = {
  rider: {
    bottom: [
      { to: '/portal', label: 'Home', icon: '🏠', exact: true },
      { to: '/portal/deliveries', label: 'Deliveries', icon: '📦' },
      { to: '/portal/cash', label: 'Cash', icon: '💰' },
      { to: '/portal/messages', label: 'Messages', icon: '💬' },
    ],
    more: [
      { to: '/portal/profile', label: 'Profile', icon: '👤' },
    ],
  },

  /* Sees everything — full dashboard mirrored into the portal. */
  super_admin: {
    bottom: [
      { to: '/portal', label: 'Home', icon: '🏠', exact: true },
      { to: '/portal/orders', label: 'Orders', icon: '🧾' },
      { to: '/portal/riders', label: 'Riders', icon: '🚲' },
      { to: '/portal/cash', label: 'Cash', icon: '💰' },
    ],
    more: [
      { to: '/portal/messages', label: 'Messages', icon: '💬', group: 'Communication' },
      { to: '/portal/settlements', label: 'Settlements', icon: '🧮', group: 'Money' },
      { to: '/portal/billing', label: 'Billing', icon: '🧾', group: 'Money' },
      { to: '/portal/receipts', label: 'Receipts', icon: '🖨️', group: 'Money' },
      { to: '/portal/payments', label: 'Payments', icon: '💳', group: 'Money' },
      { to: '/portal/expenses', label: 'Expenses', icon: '📉', group: 'Money' },
      { to: '/portal/reports', label: 'Reports', icon: '📊', group: 'Money' },
      { to: '/portal/customers', label: 'Customers', icon: '🧑‍🤝‍🧑', group: 'People' },
      { to: '/portal/staff', label: 'Staff', icon: '🧑‍💼', group: 'People' },
      { to: '/portal/rbac', label: 'Roles & Access', icon: '🔐', group: 'People' },
      { to: '/portal/products', label: 'Products', icon: '🛍️', group: 'Catalog' },
      { to: '/portal/inventory', label: 'Inventory', icon: '📦', group: 'Catalog' },
      { to: '/portal/delivery-board', label: 'Delivery Board', icon: '🗺️', group: 'System' },
      { to: '/portal/audit-log', label: 'Audit Log', icon: '📜', group: 'System' },
      { to: '/portal/settings', label: 'Settings', icon: '⚙️', group: 'System' },
      { to: '/portal/profile', label: 'Profile', icon: '👤', group: 'System' },
    ],
  },

  /* Same shape as super_admin, minus Roles & Access and Settings
     (admin lacks manage_settings per AuthContext's rolePermissions). */
  admin: {
    bottom: [
      { to: '/portal', label: 'Home', icon: '🏠', exact: true },
      { to: '/portal/orders', label: 'Orders', icon: '🧾' },
      { to: '/portal/riders', label: 'Riders', icon: '🚲' },
      { to: '/portal/cash', label: 'Cash', icon: '💰' },
    ],
    more: [
      { to: '/portal/messages', label: 'Messages', icon: '💬', group: 'Communication' },
      { to: '/portal/settlements', label: 'Settlements', icon: '🧮', group: 'Money' },
      { to: '/portal/billing', label: 'Billing', icon: '🧾', group: 'Money' },
      { to: '/portal/receipts', label: 'Receipts', icon: '🖨️', group: 'Money' },
      { to: '/portal/payments', label: 'Payments', icon: '💳', group: 'Money' },
      { to: '/portal/expenses', label: 'Expenses', icon: '📉', group: 'Money' },
      { to: '/portal/reports', label: 'Reports', icon: '📊', group: 'Money' },
      { to: '/portal/customers', label: 'Customers', icon: '🧑‍🤝‍🧑', group: 'People' },
      { to: '/portal/staff', label: 'Staff', icon: '🧑‍💼', group: 'People' },
      { to: '/portal/products', label: 'Products', icon: '🛍️', group: 'Catalog' },
      { to: '/portal/inventory', label: 'Inventory', icon: '📦', group: 'Catalog' },
      { to: '/portal/delivery-board', label: 'Delivery Board', icon: '🗺️', group: 'System' },
      { to: '/portal/profile', label: 'Profile', icon: '👤', group: 'System' },
    ],
  },

  /* Narrower again — no cash/billing/settlements/RBAC/staff per
     manager's existing permissions (manage_products, manage_orders,
     manage_customers, manage_riders, view_reports). */
  manager: {
    bottom: [
      { to: '/portal', label: 'Home', icon: '🏠', exact: true },
      { to: '/portal/orders', label: 'Orders', icon: '🧾' },
      { to: '/portal/riders', label: 'Riders', icon: '🚲' },
      { to: '/portal/messages', label: 'Messages', icon: '💬' },
    ],
    more: [
      { to: '/portal/customers', label: 'Customers', icon: '🧑‍🤝‍🧑', group: 'People' },
      { to: '/portal/products', label: 'Products', icon: '🛍️', group: 'Catalog' },
      { to: '/portal/inventory', label: 'Inventory', icon: '📦', group: 'Catalog' },
      { to: '/portal/reports', label: 'Reports', icon: '📊', group: 'Money' },
      { to: '/portal/profile', label: 'Profile', icon: '👤', group: 'System' },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
   GENERATED NAV — for any role NOT explicitly hand-tuned above.
   super_admin/admin/manager/rider stay hardcoded (their bottom-nav
   choices were deliberately curated for frequency-of-use, not
   mechanically derived). Every other role — cashier, dispatcher,
   warehouse, and any future role — gets its nav built automatically
   from that role's permissions, so adding a role or changing its
   permissions in AuthContext's rolePermissions doesn't require
   editing this file by hand.

   Mirrors AuthContext.js's rolePermissions exactly — if that map
   changes, update this copy too (kept here rather than imported
   so this file has no dependency on AuthContext's internals).
═══════════════════════════════════════════════════════════════ */
const ROLE_PERMISSIONS = {
  cashier:    ['manage_orders', 'manage_customers', 'manage_cash'],
  dispatcher: ['manage_orders', 'manage_riders'],
  warehouse:  ['manage_products'],
};

/* permission → one or more portal sections it unlocks, in the
   order they should appear if this permission is present. */
const PERMISSION_TO_SECTIONS = {
  manage_orders:    [{ to: '/portal/orders', label: 'Orders', icon: '🧾' }],
  manage_customers: [{ to: '/portal/customers', label: 'Customers', icon: '🧑‍🤝‍🧑' }],
  manage_cash:      [{ to: '/portal/cash', label: 'Cash', icon: '💰' }],
  manage_riders:    [{ to: '/portal/riders', label: 'Riders', icon: '🚲' }],
  manage_products:  [
    { to: '/portal/products', label: 'Products', icon: '🛍️' },
    { to: '/portal/inventory', label: 'Inventory', icon: '📦' },
  ],
  view_reports:     [{ to: '/portal/reports', label: 'Reports', icon: '📊' }],
  manage_users:     [{ to: '/portal/staff', label: 'Staff', icon: '🧑‍💼' }],
  manage_settings:  [{ to: '/portal/settings', label: 'Settings', icon: '⚙️' }],
  /* delete_records has no dedicated page — it's an in-page capability,
     not a section, so intentionally not mapped here. */
};

/* Builds { bottom, more } for a role with no hardcoded entry in
   ROLE_NAV. Home, Messages, and Profile are always included; the
   role's permissions (in the order listed) fill the rest — first 3
   go to the bottom bar (4 total with Home), everything else to
   "More". */
function generateNavFromPermissions(role) {
  const permissions = ROLE_PERMISSIONS[role] || [];

  const sections = [];
  permissions.forEach(perm => {
    (PERMISSION_TO_SECTIONS[perm] || []).forEach(section => {
      if (!sections.find(s => s.to === section.to)) sections.push(section);
    });
  });

  const home = { to: '/portal', label: 'Home', icon: '🏠', exact: true };
  const messages = { to: '/portal/messages', label: 'Messages', icon: '💬' };
  const profile = { to: '/portal/profile', label: 'Profile', icon: '👤' };

  /* Bottom bar fits 4 total: Home + up to 2 permission-derived
     sections + Messages. Anything beyond that goes to "More". */
  const bottomFromPerms = sections.slice(0, 2);
  const moreFromPerms = sections.slice(2);

  return {
    bottom: [home, ...bottomFromPerms, messages],
    more: [...moreFromPerms, profile],
  };
}

const ROLE_PORTAL_LABEL = {
  rider: 'Rider Portal',
  super_admin: 'Super Admin Portal',
  admin: 'Admin Portal',
  manager: 'Manager Portal',
  cashier: 'Cashier Portal',
  dispatcher: 'Dispatcher Portal',
  warehouse: 'Warehouse Portal',
};

const PortalLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.role || 'rider';
  const nav = ROLE_NAV[role] || generateNavFromPermissions(role);
  const portalLabel = ROLE_PORTAL_LABEL[role] || 'Portal';

  /* Group "More" items by their `group` label (rider has none, so
     it falls back to a flat list — keeps the rider experience the
     same shape as before). */
  const groupedMore = nav.more.reduce((acc, item) => {
    const key = item.group || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f8', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Top bar */}
      <div style={{ background: '#1a1a18', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {role === 'rider' ? '🚲' : '🌊'}
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0 }}>Shorewinds</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{portalLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0 }}>{user?.name}</p>
            <p style={{ color: '#22c55e', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
            Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {children}
      </div>

      {/* "More" sheet */}
      {showMore && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowMore(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '75vh', overflow: 'auto', padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>More</h3>
              <button onClick={() => setShowMore(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            {Object.entries(groupedMore).map(([group, items]) => (
              <div key={group || 'ungrouped'} style={{ marginBottom: 18 }}>
                {group && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                    {group}
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setShowMore(false)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#1a1a18' }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {item.icon}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #f3f4f6', display: 'flex', zIndex: 100, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
        {nav.bottom.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px', textDecoration: 'none',
              color: isActive ? '#22c55e' : '#9ca3af',
              borderTop: isActive ? '2px solid #22c55e' : '2px solid transparent',
              background: 'none', transition: 'all 0.15s',
            })}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3, letterSpacing: '0.3px' }}>{item.label}</span>
          </NavLink>
        ))}
        {nav.more.length > 0 && (
          <button
            onClick={() => setShowMore(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px', border: 'none', background: 'none', cursor: 'pointer',
              color: showMore ? '#22c55e' : '#9ca3af',
              borderTop: showMore ? '2px solid #22c55e' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>⋯</span>
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3, letterSpacing: '0.3px' }}>More</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PortalLayout;
