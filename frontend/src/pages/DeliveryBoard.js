import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, ridersAPI } from '../utils/api';
import API from '../utils/api';
import Settlements from './Settlements';
/* ─── Delivery API ────────────────────────────────────────────── */
const deliveryAPI = {
  assign:           (data)     => API.post('/riders/assign', data),
  updateStatus:     (id, data) => API.put(`/riders/delivery/${id}/status`, data),
  getActive:        (params)   => API.get('/orders', { params }),
  resetAvailability: ()        => API.post('/riders/reset-availability'),
};

/* ─── Status config ───────────────────────────────────────────── */
const STATUS = {
  pending:          { label: 'Pending',        color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  confirmed:        { label: 'Assigned',       color: '#14b8a6', bg: '#f0fdfa', border: '#99f6e4' },
  packing:          { label: 'Packing',        color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  assigned:         { label: 'Assigned',       color: '#14b8a6', bg: '#f0fdfa', border: '#99f6e4' },
  processing:       { label: 'Picked Up',      color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  out_for_delivery: { label: 'Out for Delivery', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  delivered:        { label: 'Delivered',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  failed:           { label: 'Failed',         color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
};


/* ─── Helpers ─────────────────────────────────────────────────── */
const timeAgo = (date) => {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

/* ─── Order card ──────────────────────────────────────────────── */
const OrderCard = ({ order, riders, onAssign, onStatusUpdate, onViewProof, assigning }) => {
  const [expanded, setExpanded]     = useState(false);
  const [selectedRider, setSelectedRider] = useState('');
  const st = STATUS[order.status] || STATUS.pending;
  const availableRiders = riders.filter(r => r.is_available);

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${st.border}`,
      borderLeft: `4px solid ${st.color}`,
      borderRadius: '10px',
      marginBottom: '10px',
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Card header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 14px', cursor: 'pointer',
          background: expanded ? st.bg : 'transparent',
          transition: 'background 0.15s',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Order number */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              fontWeight: '700', color: 'var(--navy)',
            }}>
              {order.order_number}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '700', padding: '2px 8px',
              borderRadius: '20px', background: st.bg, color: st.color,
              textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>
              {st.label}
            </span>
            {order.payment_method === 'cash' || order.payment_method === 'cod' ? (
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '600' }}>💵 COD</span>
            ) : (
              <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600' }}>📱 MoMo</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '3px' }}>
            {order.customer_name || '—'} · {order.customer_phone}
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--accent)' }}>
            {fmt(order.total_amount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
            {timeAgo(order.created_at)}
          </div>
        </div>

        {/* Expand chevron */}
        <div style={{
          color: 'var(--text-3)', fontSize: '12px', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▼</div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${st.border}` }}>

          {/* Delivery address */}
          <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Delivery Address
            </span>
            <p style={{ margin: '4px 0 0', fontWeight: '500' }}>
              📍 {order.delivery_address || '—'}
            </p>
          </div>

          {/* Current rider */}
          {order.rider_name && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', background: '#f0fdfa',
              borderRadius: '8px', marginBottom: '10px',
              border: '1px solid #99f6e4',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#14b8a6', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', fontSize: '12px', flexShrink: 0,
              }}>
                {order.rider_name.charAt(0)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>
                  {order.rider_name}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>
                  {order.rider_phone} · Assigned rider
                </p>
              </div>
            </div>
          )}

          {/* Assign rider — show when no delivery exists yet, or the last
              one was rejected and this order needs a new rider. Checking
              order.status alone isn't reliable here: assignDelivery sets it
              to 'confirmed' (not 'assigned'), so gating on a status string
              silently breaks the moment that value doesn't match exactly. */}
          {(!order.delivery_id || order.delivery_status === 'rejected') && !['delivered', 'failed', 'out_for_delivery'].includes(order.status) && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {order.delivery_status === 'rejected' && (
                <div style={{ width: '100%', fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
                  ⚠️ Rejected by previous rider{order.rejection_reason ? `: ${order.rejection_reason}` : ''} — needs reassignment
                </div>
              )}
              <select
                className="form-input"
                style={{ flex: 1, fontSize: '13px' }}
                value={selectedRider}
                onChange={e => setSelectedRider(e.target.value)}
              >
                <option value="">
                  {availableRiders.length === 0
                    ? 'No riders available'
                    : 'Select a rider…'}
                </option>
                {availableRiders.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.vehicle_type || 'Rider'}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-sm"
                disabled={!selectedRider || assigning === order.id}
                onClick={() => onAssign(order.id, selectedRider)}
                style={{ flexShrink: 0 }}
              >
                {assigning === order.id ? 'Assigning…' : '⊕ Assign'}
              </button>
            </div>
          )}

          {/* Update delivery status — show once a delivery exists and
              hasn't been rejected, closed out, or already delivered/failed. */}
          {order.delivery_id && order.delivery_status !== 'rejected' && !['delivered', 'failed', 'returned'].includes(order.status) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {order.status === 'confirmed' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onStatusUpdate(order.delivery_id, 'picked_up')}
                >
                  🏍️ Mark Picked Up
                </button>
              )}
              <button
                className="btn btn-success btn-sm"
                onClick={() => onStatusUpdate(order.delivery_id, 'delivered')}
              >
                ✓ Mark Delivered
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onStatusUpdate(order.delivery_id, 'failed')}
              >
                ✕ Mark Failed
              </button>
            </div>
          )}

          {/* Delivered / failed — final state */}
          {['delivered', 'failed', 'returned'].includes(order.status) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                fontSize: '12px', fontWeight: '600',
                color: order.status === 'delivered' ? '#15803d' : '#dc2626',
                padding: '6px 10px', borderRadius: '6px',
                background: order.status === 'delivered' ? '#dcfce7' : '#fee2e2',
                display: 'inline-block',
              }}>
                {order.status === 'delivered' ? '✓ Delivered' : '✕ Failed / Returned'}
              </div>
              {/* Only delivered orders can have a proof photo — the mobile
                  POD flow only captures one on the 'delivered' transition,
                  not on 'failed'. */}
              {order.status === 'delivered' && (
                <button className="btn btn-secondary btn-sm" onClick={() => onViewProof(order.id)}>
                  📷 View Proof
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Delivery Board
═══════════════════════════════════════════════════════════════ */
const DeliveryBoard = () => {
  const [orders,    setOrders]    = useState([]);
  const [riders,    setRiders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [filter,    setFilter]    = useState('active'); // active | all | unassigned
  const [lastRefresh, setLastRefresh] = useState(null);
  const [proofOrder, setProofOrder] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [ordersRes, ridersRes] = await Promise.all([
        ordersAPI.getAll({ limit: 100, start_date: today, end_date: today }),
        ridersAPI.getAll({ limit: 100 }),
      ]);
      setOrders(ordersRes.data.orders || []);
      setRiders(ridersRes.data.riders || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('DeliveryBoard fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ── Assign rider ──────────────────────────────────────────── */
  const handleAssign = async (orderId, riderId) => {
    try {
      setAssigning(orderId);
      await deliveryAPI.assign({ order_id: orderId, rider_id: parseInt(riderId) });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning rider');
    } finally {
      setAssigning(null);
    }
  };

  /* ── Update delivery status ────────────────────────────────── */
  const handleStatusUpdate = async (deliveryId, status) => {
    const labels = { picked_up: 'picked up', delivered: 'delivered', failed: 'failed' };
    if (!window.confirm(`Mark this delivery as ${labels[status]}?`)) return;
    try {
      await deliveryAPI.updateStatus(deliveryId, { status });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating delivery status');
    }
  };

  /* ── View delivery proof ───────────────────────────────────── */
  const handleViewProof = async (orderId) => {
    setLoadingProof(true);
    try {
      const res = await ordersAPI.getProof(orderId);
      setProofOrder({ order_number: orders.find(o => o.id === orderId)?.order_number, ...res.data.proof });
    } catch (err) {
      alert(err.response?.data?.message || 'Could not load delivery proof');
    } finally {
      setLoadingProof(false);
    }
  };

  /* ── Reset all rider availability ────────────────────────────── */
  const handleResetAvailability = async () => {
    if (!window.confirm('Reset ALL riders to available? Only do this if deliveries are complete.')) return;
    try {
      const res = await deliveryAPI.resetAvailability();
      alert(res.data.message);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error resetting riders');
    }
  };

  /* ── Derived ───────────────────────────────────────────────── */
  const activeStatuses   = ['pending', 'confirmed', 'packing', 'processing', 'out_for_delivery'];
  const availableRiders  = riders.filter(r => r.is_available);
  const busyRiders       = riders.filter(r => !r.is_available);
  // "Unassigned" means no live delivery, or the last one was rejected —
  // not a fixed list of order.status values, since assignDelivery sets
  // status to 'confirmed' (already assigned) rather than leaving it
  // 'pending', and a rejection can send an order back into this pool too.
  const isUnassigned     = (o) => !o.delivery_id || o.delivery_status === 'rejected';
  const unassignedOrders = orders.filter(isUnassigned);
  const outOrders        = orders.filter(o => o.status === 'out_for_delivery');
  const deliveredToday   = orders.filter(o => o.status === 'delivered');
  const failedToday      = orders.filter(o => o.status === 'failed');

  const filteredOrders = orders.filter(o => {
    if (filter === 'active')     return activeStatuses.includes(o.status);
    if (filter === 'unassigned') return isUnassigned(o);
    return true;
  });

  /* ── Loading ───────────────────────────────────────────────── */
  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading delivery board…</span>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Board</h1>
          <p className="page-subtitle">
            Today's deliveries — live view
            {lastRefresh && (
              <span style={{ marginLeft: '8px', color: 'var(--text-3)', fontSize: '11px' }}>
                · Updated {timeAgo(lastRefresh)}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
            ↻ Refresh
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleResetAvailability}>
            ⊕ Reset All Riders
          </button>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--accent-color': '#f59e0b', cursor: 'default' }}>
          <div className="stat-icon">⊡</div>
          <p className="stat-label">Unassigned</p>
          <p className="stat-value" style={{ color: '#f59e0b' }}>{unassignedOrders.length}</p>
          <p className="stat-sub">Need a rider</p>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#f97316', cursor: 'default' }}>
          <div className="stat-icon">🏍️</div>
          <p className="stat-label">Out for Delivery</p>
          <p className="stat-value" style={{ color: '#f97316' }}>{outOrders.length}</p>
          <p className="stat-sub">{busyRiders.length} rider{busyRiders.length !== 1 ? 's' : ''} on road</p>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#22c55e', cursor: 'default' }}>
          <div className="stat-icon">✓</div>
          <p className="stat-label">Delivered Today</p>
          <p className="stat-value" style={{ color: '#22c55e' }}>{deliveredToday.length}</p>
          <p className="stat-sub">
            {fmt(deliveredToday.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0))}
          </p>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#3b82f6', cursor: 'default' }}>
          <div className="stat-icon">⊕</div>
          <p className="stat-label">Available Riders</p>
          <p className="stat-value" style={{ color: '#3b82f6' }}>{availableRiders.length}</p>
          <p className="stat-sub">of {riders.length} total riders</p>
        </div>
      </div>

      {/* ── Alert for unassigned orders ─────────────────────── */}
      {unassignedOrders.length > 0 && (
        <div
          className="alert alert-warning"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilter('unassigned')}
        >
          ⚠️ <strong>{unassignedOrders.length} order{unassignedOrders.length > 1 ? 's' : ''} waiting for a rider.</strong>
          {' '}Click to view unassigned orders.
        </div>
      )}

      {/* ── Main content — two columns ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>

        {/* ── Left: Orders ──────────────────────────────────── */}
        <div>
          {/* Filter tabs */}
          <div className="tabs" style={{ marginBottom: '16px' }}>
            {[
              { key: 'active',     label: `Active (${orders.filter(o => activeStatuses.includes(o.status)).length})` },
              { key: 'unassigned', label: `Unassigned (${unassignedOrders.length})` },
              { key: 'all',        label: `All Today (${orders.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                className={`tab-btn${filter === tab.key ? ' active' : ''}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Order cards */}
          {filteredOrders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">⊡</div>
                <h3>
                  {filter === 'unassigned'
                    ? 'All orders assigned'
                    : filter === 'active'
                    ? 'No active orders'
                    : 'No orders today'}
                </h3>
                <p>
                  {filter === 'unassigned'
                    ? 'Every order has a rider assigned.'
                    : 'New orders will appear here automatically.'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  riders={riders}
                  onAssign={handleAssign}
                  onStatusUpdate={handleStatusUpdate}
                  onViewProof={handleViewProof}
                  assigning={assigning}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Rider panel ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Available riders */}
          <div className="card">
            <div className="card-header">
              <p className="card-title">
                Available Riders
                <span className="badge badge-green" style={{ marginLeft: '8px' }}>
                  {availableRiders.length}
                </span>
              </p>
            </div>
            {availableRiders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)', fontSize: '13px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>⊕</div>
                All riders are busy
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableRiders.map(rider => (
                  <div
                    key={rider.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '8px',
                      background: '#f0fdf4', border: '1px solid #bbf7d0',
                    }}
                  >
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: '#22c55e', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '12px', flexShrink: 0,
                    }}>
                      {rider.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>
                        {rider.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>
                        {rider.vehicle_type || 'Rider'} · {rider.phone}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: '700', padding: '2px 6px',
                      borderRadius: '10px', background: '#dcfce7', color: '#15803d',
                      textTransform: 'uppercase',
                    }}>Free</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Busy riders */}
          {busyRiders.length > 0 && (
            <div className="card">
              <div className="card-header">
                <p className="card-title">
                  On the Road
                  <span className="badge badge-orange" style={{ marginLeft: '8px' }}>
                    {busyRiders.length}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {busyRiders.map(rider => (
                  <div
                    key={rider.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '8px',
                      background: '#fff7ed', border: '1px solid #fed7aa',
                    }}
                  >
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: '#f97316', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '12px', flexShrink: 0,
                    }}>
                      {rider.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>
                        {rider.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>
                        {rider.vehicle_type || 'Rider'} · {rider.phone}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: '700', padding: '2px 6px',
                      borderRadius: '10px', background: '#ffedd5', color: '#c2410c',
                      textTransform: 'uppercase',
                    }}>Busy</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's summary */}
          <div className="card">
            <p className="card-title" style={{ marginBottom: '12px' }}>Today's Summary</p>
            {[
              { label: 'Total orders',    value: orders.length,          color: 'var(--text)' },
              { label: 'Delivered',       value: deliveredToday.length,  color: '#22c55e' },
              { label: 'Out for delivery',value: outOrders.length,       color: '#f97316' },
              { label: 'Failed',          value: failedToday.length,     color: '#ef4444' },
              { label: 'Unassigned',      value: unassignedOrders.length,color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '7px 0',
                  borderBottom: '1px solid var(--border-2)',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
                <span style={{ fontWeight: '700', fontSize: '14px', color }}>{value}</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 0 0',
              marginTop: '2px',
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                Revenue
              </span>
              <span style={{ fontWeight: '800', fontSize: '15px', color: 'var(--accent)' }}>
                {fmt(deliveredToday.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0))}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile: stack columns on small screens */}
      <style>{`
        @media (max-width: 768px) {
          .delivery-board-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Delivery proof modal */}
      {proofOrder && (
        <div onClick={() => setProofOrder(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Delivery Proof — {proofOrder.order_number}</h3>
              <button onClick={() => setProofOrder(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {proofOrder.proof_photo ? (
              <img src={proofOrder.proof_photo} alt="Delivery proof" style={{ width: '100%', borderRadius: '10px', marginBottom: '14px' }} />
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '10px', marginBottom: '14px', fontSize: '13px' }}>
                No photo was captured for this delivery
              </div>
            )}

            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              {proofOrder.recipient_name && (
                <div><span style={{ color: '#9ca3af' }}>Received by:</span> <strong>{proofOrder.recipient_name}</strong></div>
              )}
              {proofOrder.delivery_notes && (
                <div><span style={{ color: '#9ca3af' }}>Notes:</span> {proofOrder.delivery_notes}</div>
              )}
              {proofOrder.delivered_at && (
                <div><span style={{ color: '#9ca3af' }}>Delivered at:</span> {new Date(proofOrder.delivered_at).toLocaleString()}</div>
              )}
              {!proofOrder.recipient_name && !proofOrder.delivery_notes && !proofOrder.proof_photo && (
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No proof details were recorded for this delivery.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {loadingProof && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '16px 24px', borderRadius: '10px', fontSize: '13px', color: '#6b7280' }}>Loading proof…</div>
        </div>
      )}

    </div>
  );
};

export default DeliveryBoard;
