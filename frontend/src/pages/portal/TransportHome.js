import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI, cashAPI, returnsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const formatCurrency = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);
const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

// Orders still in flight for this agent's delivery stat. Confirmed against
// DeliveryBoard.js's real status enum: pending → confirmed → packing →
// assigned → out_for_delivery → delivered / failed / returned.
const CLOSED_STATUSES = ['delivered', 'failed', 'returned', 'cancelled'];
const isOpenOrder = (status) => !CLOSED_STATUSES.includes(status);

const isToday = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const quickActions = [
  { to: '/transport/billing', label: 'New Sale', icon: '🧾', bg: '#f0fdf4', desc: 'Create an order' },
  { to: '/transport/products', label: 'Stock', icon: '🔍', bg: '#eff6ff', desc: 'Check prices & stock' },
  { to: '/transport/inventory', label: 'Inventory', icon: '📊', bg: '#fffbeb', desc: 'Activity & reports' },
];

const TransportHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [pendingCashTotal, setPendingCashTotal] = useState(0);
  const [pendingReturns, setPendingReturns] = useState(0);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [o, c] = await Promise.all([
        ordersAPI.getAll({ limit: 100 }),
        cashAPI.getAll({ limit: 100 }),
      ]);
      setOrders(o.data.orders || []);
      const logs = c.data.logs || [];
      setPendingCashTotal(logs.filter(l => l.status === 'pending').reduce((s, l) => s + parseFloat(l.amount || 0), 0));
      try {
        const r = await returnsAPI.getAll({ assigned_to: 'me', status: 'pending_enquiry' });
        setPendingReturns(r.data.total || 0);
      } catch (e) { /* not fatal to the rest of the dashboard */ }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const myOrders = useMemo(() => orders.filter(o => o.created_by === user?.id), [orders, user?.id]);
  const todaysOrders = useMemo(() => myOrders.filter(o => isToday(o.created_at)), [myOrders]);
  const todaysTotal = todaysOrders.reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0);
  const pendingDeliveries = myOrders.filter(o => isOpenOrder(o.status));
  const recentOrders = [...myOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statusColor = (status) => {
    if (status === 'delivered') return { bg: '#f0fdf4', color: '#16a34a' };
    if (CLOSED_STATUSES.includes(status)) return { bg: '#fef2f2', color: '#ef4444' }; // failed / returned
    return { bg: '#eff6ff', color: '#1d4ed8' };
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 2px' }}>{greeting()},</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', margin: 0 }}>{user?.name?.split(' ')[0] || 'there'} 👋</h1>
      </div>

      {pendingReturns > 0 && (
        <div
          onClick={() => navigate('/transport/returns')}
          style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
            padding: '14px 16px', marginBottom: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
                {pendingReturns} return{pendingReturns === 1 ? '' : 's'} awaiting your enquiry
              </div>
              <div style={{ fontSize: 12, color: '#b45309' }}>Tap to complete — stock stays on hold until you do</div>
            </div>
          </div>
          <span style={{ color: '#b45309', fontSize: 18 }}>›</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Today's Sales</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', marginTop: 4 }}>{todaysOrders.length}</div>
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>{formatCurrency(todaysTotal)}</div>
        </div>
        <div style={{ ...card, marginBottom: 0, padding: '14px 16px' }} onClick={() => navigate('/transport/deliveries')}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Open Deliveries</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', marginTop: 4 }}>{pendingDeliveries.length}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>from your sales</div>
        </div>
      </div>

      <div style={{ ...card, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate('/transport/cash')}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending Cash (all riders)</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Awaiting verification</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{formatCurrency(pendingCashTotal)}</div>
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 18, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Quick Actions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {quickActions.map(a => (
          <button key={a.to} onClick={() => navigate(a.to)}
            style={{ ...card, marginBottom: 0, padding: '16px 10px', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, margin: '0 auto 8px' }}>
              {a.icon}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Recent sales */}
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Recent Sales</span>
        <button onClick={() => navigate('/transport/billing')} style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
      </div>

      {recentOrders.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '30px 16px' }}>
          No sales yet — tap "New Sale" to create your first one.
        </div>
      ) : (
        recentOrders.map(o => {
          const sc = statusColor(o.status);
          return (
            <div key={o.id} style={{ ...card, marginBottom: 10, padding: '13px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{o.customer_name || o.customer?.name || 'Customer'}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{o.order_number} · {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a18' }}>{formatCurrency(o.total_amount || o.total)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                    {o.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default TransportHome;
