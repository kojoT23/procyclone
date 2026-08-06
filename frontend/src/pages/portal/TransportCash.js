import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cashAPI, ordersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const fmt = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);
const card = { background: '#fff', borderRadius: 14, marginBottom: 10, padding: '13px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

const STATUS = {
  pending:  { label: 'Pending',  bg: '#fffbeb', color: '#d97706' },
  verified: { label: 'Verified', bg: '#f0fdf4', color: '#16a34a' },
  disputed: { label: 'Disputed', bg: '#fef2f2', color: '#ef4444' },
};

const timeAgo = (date) => {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const TransportCash = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [verifyingId, setVerifyingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([
        ordersAPI.getAll({ limit: 100 }),
        cashAPI.getAll({ limit: 200 }),
      ]);
      setOrders((o.data.orders || []).filter(ord => ord.created_by === user?.id));
      setLogs(c.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleVerify = async (log) => {
    if (!window.confirm('Confirm you physically received this cash and it matches the amount shown?')) return;
    setVerifyingId(log.id);
    try {
      await cashAPI.verify(log.id);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not verify — this is only allowed for physical cash sales.');
    } finally {
      setVerifyingId(null);
    }
  };

  // Only cash logs tied to an order this agent actually created — cash
  // logs themselves reference rider_id, not the agent, so this is the
  // only reliable way to scope "my" cash without a backend change.
  const myOrderIds = useMemo(() => new Set(orders.map(o => o.id)), [orders]);
  const orderById = useMemo(() => Object.fromEntries(orders.map(o => [o.id, o])), [orders]);
  const myLogs = useMemo(() => logs.filter(l => myOrderIds.has(l.order_id)), [logs, myOrderIds]);

  const pending = myLogs.filter(l => l.status === 'pending');
  const verified = myLogs.filter(l => l.status === 'verified');
  const pendingTotal = pending.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  const verifiedTotal = verified.reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  const filteredLogs = myLogs
    .filter(l => filter === 'all' || l.status === filter)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Cash</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 4 }}>{fmt(pendingTotal)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{pending.length} COD sale{pending.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Verified</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{fmt(verifiedTotal)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{verified.length} COD sale{verified.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'verified', label: 'Verified' },
          { key: 'disputed', label: 'Disputed' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: filter === t.key ? '1px solid #22c55e' : '1px solid #e5e7eb',
              background: filter === t.key ? '#f0fdf4' : '#fff',
              color: filter === t.key ? '#16a34a' : '#6b7280',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {filteredLogs.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
          No cash records for your sales{filter !== 'all' ? ` with status "${filter}"` : ''} yet.
        </div>
      ) : (
        filteredLogs.map(log => {
          const st = STATUS[log.status] || STATUS.pending;
          const order = orderById[log.order_id];
          return (
            <div key={log.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{order?.customer_name || order?.order_number || `Order #${log.order_id}`}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {log.rider_name ? `Collected by ${log.rider_name}` : 'Rider unknown'} · {timeAgo(log.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a18' }}>{fmt(log.amount)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, marginTop: 4, display: 'inline-block' }}>
                    {st.label}
                  </span>
                </div>
              </div>
              {/* Only physical cash — not COD — matches the backend rule.
                  Not shown for COD logs at all rather than shown-then-403,
                  since a button that always fails isn't useful. */}
              {log.status === 'pending' && order?.payment_method === 'cash' && (
                <button onClick={() => handleVerify(log)} disabled={verifyingId === log.id}
                  style={{ marginTop: 10, width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: verifyingId === log.id ? 0.6 : 1 }}>
                  {verifyingId === log.id ? 'Verifying…' : '✓ Verify — I received this cash'}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default TransportCash;
