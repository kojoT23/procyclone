import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '../../utils/api';

/* Mirrors STATUS_COLORS / STATUSES from the dashboard's Orders.js
   so badge colors and the status dropdown stay consistent between
   desktop and portal. */
const STATUS_COLORS = {
  pending:          { bg: '#fef3c7', text: '#d97706' },
  confirmed:        { bg: '#dbeafe', text: '#1d4ed8' },
  packing:          { bg: '#ede9fe', text: '#7c3aed' },
  assigned:         { bg: '#ccfbf1', text: '#0f766e' },
  out_for_delivery: { bg: '#fed7aa', text: '#c2410c' },
  delivered:        { bg: '#dcfce7', text: '#16a34a' },
  failed:           { bg: '#fee2e2', text: '#dc2626' },
  returned:         { bg: '#f1f5f9', text: '#475569' },
};

const STATUSES = [
  'pending', 'confirmed', 'packing', 'assigned',
  'out_for_delivery', 'delivered', 'failed', 'returned',
];

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

export default function PortalOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 30 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    try {
      await ordersAPI.updateStatus(orderId, { status });
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  /* Quick filter pills — pending/confirmed/out_for_delivery cover
     the states someone checking from their phone cares about most;
     "All" and the rest are reachable via the dropdown below. */
  const quickFilters = ['', 'pending', 'confirmed', 'out_for_delivery'];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Orders</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{total} total</p>
      </div>

      {/* Search */}
      <input
        className="form-input"
        placeholder="Search by order number or customer…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 10, width: '100%' }}
      />

      {/* Quick filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {quickFilters.map(s => (
          <button
            key={s || 'all'}
            onClick={() => setFilterStatus(s)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: filterStatus === s ? '#1a1a18' : '#fff',
              color: filterStatus === s ? '#fff' : '#6b7280',
              boxShadow: filterStatus === s ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
          <p style={{ color: '#6b7280' }}>No orders match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(order => {
            const isExpanded = expandedId === order.id;
            const colors = STATUS_COLORS[order.status] || { bg: '#f1f5f9', text: '#475569' };
            return (
              <div key={order.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{order.order_number}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginTop: 2 }}>{order.customer_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{fmt(order.total_amount)}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, background: colors.bg, color: colors.text, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize' }}>
                      {order.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      {order.payment_method === 'cod' ? '💵 Cash on delivery' : `💳 ${order.payment_method?.toUpperCase() || '—'}`}
                      {order.delivery_address ? ` · 📍 ${order.delivery_address}` : ''}
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                      Update status
                    </label>
                    <select
                      className="form-input"
                      value={order.status}
                      disabled={updating === order.id}
                      onChange={e => updateStatus(order.id, e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
