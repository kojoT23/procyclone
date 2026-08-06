import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, ridersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ReceiptDocument } from '../Receipts'; // side-effect: also loads Receipts.css

// Same status set and transitions as the desktop DeliveryBoard —
// kept identical on purpose so behavior never diverges between the two.
const STATUS = {
  pending:          { label: 'Pending',          color: '#f59e0b', bg: '#fffbeb' },
  confirmed:        { label: 'Confirmed',        color: '#3b82f6', bg: '#eff6ff' },
  packing:          { label: 'Packing',          color: '#8b5cf6', bg: '#f5f3ff' },
  assigned:         { label: 'Assigned',         color: '#14b8a6', bg: '#f0fdfa' },
  processing:       { label: 'Picked Up',        color: '#0891b2', bg: '#ecfeff' },
  out_for_delivery: { label: 'Out for Delivery', color: '#f97316', bg: '#fff7ed' },
  delivered:        { label: 'Delivered',        color: '#22c55e', bg: '#f0fdf4' },
  failed:           { label: 'Failed',           color: '#ef4444', bg: '#fef2f2' },
  returned:         { label: 'Returned',         color: '#ef4444', bg: '#fef2f2' },
  cancelled:        { label: 'Cancelled',        color: '#6b7280', bg: '#f3f4f6' },
};
const CLOSED_STATUSES = ['delivered', 'failed', 'returned', 'cancelled'];

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

const OrderCard = ({ order, riders, onAssign, onStatusUpdate, onRequestPOD, onPrint, printingId, onCancel, cancellingId, busy }) => {
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

          <button onClick={() => onPrint(order.id)} disabled={printingId === order.id}
            style={{ ...btn, background: '#fff', color: '#1a1a18', border: '1px solid #e5e7eb', marginBottom: 10, opacity: printingId === order.id ? 0.6 : 1 }}>
            {printingId === order.id ? 'Preparing…' : '🖨️ Receipt'}
          </button>

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

          {!order.delivery_id && (
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

          {/* Matches the backend's exact rule — cancellation is only
              allowed while status is 'pending', i.e. before a rider is
              assigned (which moves it to 'confirmed'). */}
          {order.status === 'pending' && (
            <button onClick={() => onCancel(order)} disabled={cancellingId === order.id}
              style={{ ...btn, background: '#fef2f2', color: '#ef4444', marginTop: 8, opacity: cancellingId === order.id ? 0.6 : 1 }}>
              {cancellingId === order.id ? 'Cancelling…' : '✕ Cancel Order'}
            </button>
          )}

          {/* Keyed off delivery_status (the deliveries table's own status),
              NOT order.status — order.status includes transitional values
              like 'processing' (set the moment a rider is marked picked up)
              that don't belong to the order-lifecycle enum these buttons
              were originally written against. Keying off order.status here
              meant the Delivered/Failed buttons vanished entirely right
              after tapping Picked Up — delivery_status is the correct
              source of truth for "what stage is the rider at." */}
          {/* Rejected is its own branch, not folded into the normal active
              flow — none of Picked Up/Delivered/Failed apply anymore since
              this rider explicitly declined. It's also NOT in
              CLOSED_STATUSES: the order goes back to 'pending' on
              rejection, so this needs reassignment, not to be treated as
              finished. */}
          {order.delivery_id && order.delivery_status === 'rejected' && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fef2f2', padding: '8px 10px', borderRadius: 6 }}>
              ✕ Rider rejected{order.rejection_reason ? ` — ${order.rejection_reason}` : ''}. Reassign via Scheduler.
            </div>
          )}

          {order.delivery_id && order.delivery_status !== 'rejected' && !CLOSED_STATUSES.includes(order.delivery_status) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Purely informational — this reflects whether the rider has
                  tapped Accept on their own Deliveries page yet. Support
                  staff don't accept on a rider's behalf; this just shows
                  where things stand. */}
              {(!order.delivery_status || order.delivery_status === 'assigned') && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '6px 10px', borderRadius: 6 }}>
                  ⏳ Waiting for rider to accept
                </span>
              )}
              {order.delivery_status === 'accepted' && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', background: '#eff6ff', padding: '6px 10px', borderRadius: 6 }}>
                  ✓ Rider accepted
                </span>
              )}
              {['assigned', 'accepted', undefined, null].includes(order.delivery_status) && (
                <button onClick={() => onStatusUpdate(order.delivery_id, 'picked_up')} style={{ ...btn, background: '#f3f4f6', color: '#1a1a18' }}>
                  🏍️ Picked Up
                </button>
              )}
              <button onClick={() => onRequestPOD(order)} style={{ ...btn, background: '#22c55e', color: '#fff' }}>
                ✓ Delivered
              </button>
              <button onClick={() => onStatusUpdate(order.delivery_id, 'failed')} style={{ ...btn, background: '#ef4444', color: '#fff' }}>
                ✕ Failed
              </button>
            </div>
          )}

          {order.delivery_id && CLOSED_STATUSES.includes(order.delivery_status) && (
            <div style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: '7px 10px', borderRadius: 6, display: 'inline-block' }}>
              {order.delivery_status === 'delivered' ? '✓ Delivered' : order.delivery_status === 'failed' ? '✕ Failed' : '↩ Returned'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PODModal = ({ order, onClose, onConfirm }) => {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [skipPhoto, setSkipPhoto] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleConfirm = async () => {
    if (!photoFile && !skipPhoto) {
      setError('Add a photo, or check "No photo available" below');
      return;
    }
    if (skipPhoto && !notes.trim()) {
      setError('Please explain why no photo was taken');
      return;
    }
    setSubmitting(true);
    try {
      const extra = { recipient_name: recipientName || undefined, delivery_notes: notes || undefined };
      if (photoFile) extra.proof_photo = await compressImage(photoFile);
      await onConfirm(extra);
    } catch (err) {
      setError('Could not process photo — try again or use "No photo available"');
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 28px' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a18', marginBottom: 2 }}>Confirm Delivery</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{order.order_number} · {order.customer_name}</div>

        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Proof Photo</span>

        {photoPreview ? (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <img src={photoPreview} alt="Delivery proof" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12 }} />
            <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
              style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 110, borderRadius: 12, border: '2px dashed #d1d5db', color: '#9ca3af',
            cursor: skipPhoto ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: skipPhoto ? 0.5 : 1,
          }}>
            <span style={{ fontSize: 24 }}>📷</span>
            <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Tap to take photo</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={skipPhoto} style={{ display: 'none' }} />
          </label>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={skipPhoto} onChange={e => { setSkipPhoto(e.target.checked); if (e.target.checked) { setPhotoFile(null); setPhotoPreview(null); } setError(''); }} />
          No photo available (requires a note explaining why)
        </label>

        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Received by (optional)</span>
        <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Name of person who received it"
          style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />

        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>
          Notes {skipPhoto && <span style={{ color: '#ef4444' }}>(required)</span>}
        </span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={skipPhoto ? 'Why is there no photo?' : 'Optional delivery notes'}
          style={{ width: '100%', minHeight: 60, padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={submitting} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Confirming…' : 'Confirm Delivery'}
          </button>
        </div>
      </div>
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
  const [podOrder, setPodOrder] = useState(null); // order currently in the POD capture flow
  const [printOrder, setPrintOrder] = useState(null); // full order object queued for printing
  const [printingId, setPrintingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

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
      if (err.response?.data?.code === 'PAYMENT_NOT_VERIFIED') {
        alert('This order\'s MoMo payment needs to be verified on the dashboard before a rider can be assigned.');
      } else {
        alert(err.response?.data?.message || 'Error assigning rider');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order) => {
    const reason = window.prompt(`Cancel order ${order.order_number}? Add a reason (optional):`);
    if (reason === null) return;
    setCancellingId(order.id);
    try {
      await ordersAPI.cancel(order.id, { reason });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrint = async (orderId) => {
    setPrintingId(orderId);
    try {
      const res = await ordersAPI.getOne(orderId);
      // Full order detail (with items) is a different shape than the list
      // response this page otherwise uses — same pattern as desktop
      // Receipts.js, which also fetches per-order detail before printing.
      setPrintOrder(res.data.order);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not load receipt');
    } finally {
      setPrintingId(null);
    }
  };

  // Waits for printOrder to actually be in the DOM (inside the .print-only
  // div rendered below) before calling window.print() — same 400ms
  // settle delay desktop Receipts.js uses, since printing immediately on
  // state-set can race the render.
  useEffect(() => {
    if (!printOrder) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [printOrder]);

  const handleStatusUpdate = async (deliveryId, status, extra = {}) => {
    if (status !== 'delivered') {
      const labels = { picked_up: 'picked up', failed: 'failed' };
      if (!window.confirm(`Mark this delivery as ${labels[status]}?`)) return;
    }
    try {
      await ridersAPI.updateDeliveryStatus(deliveryId, { status, ...extra });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating delivery status');
    }
  };

  // "Active" = not yet finished at the delivery level. Deliberately not
  // keyed off order.status (which includes transitional values like
  // 'processing' that this list has no reason to special-case) — an order
  // is active as long as it either has no delivery yet, or has one that
  // hasn't reached a closed delivery_status.
  const isActiveOrder = (o) => !o.delivery_id || !CLOSED_STATUSES.includes(o.delivery_status);

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return isActiveOrder(o);
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
          { key: 'active', label: `Active (${orders.filter(isActiveOrder).length})` },
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
            <OrderCard key={order.id} order={order} riders={riders} onAssign={handleAssign} onStatusUpdate={handleStatusUpdate} onRequestPOD={setPodOrder} onPrint={handlePrint} printingId={printingId} onCancel={handleCancel} cancellingId={cancellingId} busy={busyId === order.id} />
          ))
      )}

      {podOrder && (
        <PODModal
          order={podOrder}
          onClose={() => setPodOrder(null)}
          onConfirm={async (extra) => {
            await handleStatusUpdate(podOrder.delivery_id, 'delivered', extra);
            setPodOrder(null);
          }}
        />
      )}

      {printOrder && (
        <div className="print-only">
          <ReceiptDocument order={printOrder} />
        </div>
      )}
    </div>
  );
};

export default TransportDeliveries;
