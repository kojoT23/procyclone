import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, ridersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// Same status set and transitions as the desktop DeliveryBoard —
// kept identical on purpose so behavior never diverges between the two.
const STATUS = {
  pending:          { label: 'Pending',          color: '#f59e0b', bg: '#fffbeb' },
  confirmed:        { label: 'Confirmed',        color: '#3b82f6', bg: '#eff6ff' },
  packing:          { label: 'Packing',          color: '#8b5cf6', bg: '#f5f3ff' },
  assigned:         { label: 'Assigned',         color: '#14b8a6', bg: '#f0fdfa' },
  out_for_delivery: { label: 'Out for Delivery', color: '#f97316', bg: '#fff7ed' },
  delivered:        { label: 'Delivered',        color: '#22c55e', bg: '#f0fdf4' },
  failed:           { label: 'Failed',           color: '#ef4444', bg: '#fef2f2' },
  returned:         { label: 'Returned',         color: '#ef4444', bg: '#fef2f2' },
};
const ACTIVE_STATUSES = ['pending', 'confirmed', 'packing', 'assigned', 'out_for_delivery'];
const UNASSIGNED_STATUSES = ['pending', 'confirmed', 'packing'];
const CLOSED_STATUSES = ['delivered', 'failed', 'returned'];

const fmt = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);
const timeAgo = (date) => {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Downscale + JPEG-compress the POD photo client-side before it ever hits
// the network — a full-res phone photo can be 3-5MB, which is a real
// problem on the network conditions this portal has to work under.
// Caps the long edge at 900px and re-encodes at 0.6 quality, which is
// plenty for "proof this was delivered" without being a multi-MB upload.
const compressImage = (file, maxDim = 900, quality = 0.6) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read image'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not load image'));
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const card = { background: '#fff', borderRadius: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };
const btn = { padding: '9px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' };

const OrderCard = ({ order, riders, onAssign, onStatusUpdate, busy }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedRider, setSelectedRider] = useState('');
  const st = STATUS[order.status] || STATUS.pending;
  const availableRiders = riders.filter(r => r.is_available);

  return (
    <div style={{ ...card, borderLeft: `4px solid ${st.color}` }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '13px 16px', cursor: 'pointer', background: expanded ? st.bg : '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{order.order_number}</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                {st.label}
              </span>
              {(order.payment_method === 'cash' || order.payment_method === 'cod') ? (
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>💵 COD</span>
              ) : (
                <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>📱 MoMo</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{order.customer_name || '—'}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1a1a18' }}>{fmt(order.total_amount)}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(order.created_at)}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Delivery Address</span>
            <p style={{ margin: '3px 0 0', fontWeight: 600, color: '#1a1a18' }}>📍 {order.delivery_address || '—'}</p>
          </div>

          {order.rider_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f0fdfa', borderRadius: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#14b8a6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {order.rider_name.charAt(0)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{order.rider_name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{order.rider_phone}</p>
              </div>
            </div>
          )}

          {UNASSIGNED_STATUSES.includes(order.status) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={selectedRider} onChange={e => setSelectedRider(e.target.value)}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
                <option value="">{availableRiders.length === 0 ? 'No riders available' : 'Select a rider…'}</option>
                {availableRiders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button disabled={!selectedRider || busy} onClick={() => onAssign(order.id, selectedRider)}
                style={{ ...btn, background: '#1a1a18', color: '#fff', opacity: (!selectedRider || busy) ? 0.5 : 1, flexShrink: 0 }}>
                {busy ? '…' : 'Assign'}
              </button>
            </div>
          )}

          {['assigned', 'out_for_delivery'].includes(order.status) && order.delivery_id && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {order.status === 'assigned' && (
                <button onClick={() => onStatusUpdate(order.delivery_id, 'picked_up')} style={{ ...btn, background: '#f3f4f6', color: '#1a1a18' }}>
                  🏍️ Picked Up
                </button>
              )}
              <button onClick={() => onStatusUpdate(order.delivery_id, 'delivered')} style={{ ...btn, background: '#22c55e', color: '#fff' }}>
                ✓ Delivered
              </button>
              <button onClick={() => onStatusUpdate(order.delivery_id, 'failed')} style={{ ...btn, background: '#ef4444', color: '#fff' }}>
                ✕ Failed
              </button>
            </div>
          )}

          {CLOSED_STATUSES.includes(order.status) && (
            <div style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: '7px 10px', borderRadius: 6, display: 'inline-block' }}>
              {order.status === 'delivered' ? '✓ Delivered' : order.status === 'failed' ? '✕ Failed' : '↩ Returned'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TransportDeliveries = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('active');

  const fetchAll = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        ordersAPI.getAll({ limit: 100 }),
        ridersAPI.getAll({ limit: 100 }),
      ]);
      setOrders((o.data.orders || []).filter(ord => ord.created_by === user?.id));
      setRiders(r.data.riders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleAssign = async (orderId, riderId) => {
    setBusyId(orderId);
    try {
      await ridersAPI.assignDelivery({ order_id: orderId, rider_id: parseInt(riderId) });
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning rider');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusUpdate = async (deliveryId, status) => {
    const labels = { picked_up: 'picked up', delivered: 'delivered', failed: 'failed' };
    if (!window.confirm(`Mark this delivery as ${labels[status]}?`)) return;
    try {
      await ridersAPI.updateDeliveryStatus(deliveryId, { status });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating delivery status');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(o.status);
    return true;
  });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Deliveries</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { key: 'active', label: `Active (${orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length})` },
          { key: 'all', label: `All (${orders.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: filter === t.key ? '1px solid #22c55e' : '1px solid #e5e7eb',
              background: filter === t.key ? '#f0fdf4' : '#fff',
              color: filter === t.key ? '#16a34a' : '#6b7280',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
          {filter === 'active' ? 'No active deliveries right now.' : 'No deliveries yet.'}
        </div>
      ) : (
        filteredOrders
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(order => (
            <OrderCard key={order.id} order={order} riders={riders} onAssign={handleAssign} onStatusUpdate={handleStatusUpdate} busy={busyId === order.id} />
          ))
      )}
    </div>
  );
};

export default TransportDeliveries;
