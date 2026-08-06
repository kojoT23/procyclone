import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI, ordersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ReceiptDocument } from '../Receipts'; // side-effect: also loads Receipts.css

// Delivery-level status (not order.status) — this is what
// getRiderDeliveries returns directly on each row's `status` field.
// assigned (initial) -> accepted -> picked_up -> delivered/failed/returned
const STATUS = {
  assigned:  { label: 'New',        color: '#14b8a6', bg: '#f0fdfa' },
  accepted:  { label: 'Accepted',   color: '#3b82f6', bg: '#eff6ff' },
  rejected:  { label: 'Rejected',   color: '#ef4444', bg: '#fef2f2' },
  picked_up: { label: 'Picked Up',  color: '#0891b2', bg: '#ecfeff' },
  delivered: { label: 'Delivered',  color: '#22c55e', bg: '#f0fdf4' },
  failed:    { label: 'Failed',     color: '#ef4444', bg: '#fef2f2' },
  returned:  { label: 'Returned',   color: '#ef4444', bg: '#fef2f2' },
};
const CLOSED_STATUSES = ['delivered', 'failed', 'returned', 'rejected'];

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

const PODModal = ({ delivery, onClose, onConfirm }) => {
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
    if (!photoFile && !skipPhoto) { setError('Add a photo, or check "No photo available" below'); return; }
    if (skipPhoto && !notes.trim()) { setError('Please explain why no photo was taken'); return; }
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
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{delivery.order_number} · {delivery.customer_name}</div>

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

const DeliveryCard = ({ delivery, onAccept, onReject, onStatusUpdate, onRequestPOD, onPrint, printingId, busy }) => {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS[delivery.status] || STATUS.assigned;

  return (
    <div style={{ ...card, borderLeft: `4px solid ${st.color}` }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '13px 16px', cursor: 'pointer', background: expanded ? st.bg : '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{delivery.order_number}</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                {st.label}
              </span>
              {(delivery.payment_method === 'cash' || delivery.payment_method === 'cod') ? (
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>💵 COD</span>
              ) : (
                <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>📱 MoMo</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{delivery.customer_name || '—'}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1a1a18' }}>{fmt(delivery.total_amount)}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(delivery.assigned_at)}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Delivery Address</span>
            <p style={{ margin: '3px 0 0', fontWeight: 600, color: '#1a1a18' }}>📍 {delivery.delivery_address || delivery.customer_address || '—'}</p>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            {delivery.customer_phone && (
              <a href={`tel:${delivery.customer_phone}`} style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
                📞 Call {delivery.customer_name}
              </a>
            )}
            {(delivery.delivery_address || delivery.customer_address) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.delivery_address || delivery.customer_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}
              >
                📍 Directions
              </a>
            )}
          </div>

          {delivery.items?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Items</span>
              {delivery.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', color: '#1a1a18' }}>
                  <span>{item.quantity}× {item.product_name}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.total_price)}</span>
                </div>
              ))}
            </div>
          )}

          {delivery.order_notes && (
            <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
              📝 {delivery.order_notes}
            </div>
          )}

          {/* Status progression: assigned -> accepted/rejected -> picked_up -> delivered/failed */}
          {(!delivery.status || delivery.status === 'assigned') && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onAccept(delivery)} disabled={busy}
                style={{ ...btn, flex: 1, padding: '11px 0', background: '#22c55e', color: '#fff', fontSize: 13, opacity: busy ? 0.6 : 1 }}>
                {busy ? '…' : '✓ Accept'}
              </button>
              <button onClick={() => onReject(delivery)} disabled={busy}
                style={{ ...btn, flex: 1, padding: '11px 0', background: '#fef2f2', color: '#dc2626', fontSize: 13, opacity: busy ? 0.6 : 1 }}>
                ✕ Reject
              </button>
            </div>
          )}

          {delivery.status === 'accepted' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onStatusUpdate(delivery.id, 'picked_up')} style={{ ...btn, background: '#f3f4f6', color: '#1a1a18' }}>
                🏍️ Picked Up
              </button>
              <button onClick={() => onStatusUpdate(delivery.id, 'failed')} style={{ ...btn, background: '#ef4444', color: '#fff' }}>
                ✕ Failed
              </button>
            </div>
          )}

          {delivery.status === 'picked_up' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onRequestPOD(delivery)} style={{ ...btn, background: '#22c55e', color: '#fff' }}>
                ✓ Delivered
              </button>
              <button onClick={() => onStatusUpdate(delivery.id, 'failed')} style={{ ...btn, background: '#ef4444', color: '#fff' }}>
                ✕ Failed
              </button>
            </div>
          )}

          {CLOSED_STATUSES.includes(delivery.status) && (
            <div style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: '7px 10px', borderRadius: 6, display: 'inline-block' }}>
              {delivery.status === 'delivered' ? '✓ Delivered' : delivery.status === 'failed' ? '✕ Failed' : delivery.status === 'rejected' ? `✕ Rejected${delivery.rejection_reason ? ` — ${delivery.rejection_reason}` : ''}` : '↩ Returned'}
            </div>
          )}

          <button onClick={() => onPrint(delivery.order_id)} disabled={printingId === delivery.order_id}
            style={{ ...btn, background: '#fff', color: '#1a1a18', border: '1px solid #e5e7eb', marginTop: 8, opacity: printingId === delivery.order_id ? 0.6 : 1 }}>
            {printingId === delivery.order_id ? 'Preparing…' : '🖨️ Receipt'}
          </button>
        </div>
      )}
    </div>
  );
};

const PortalDeliveries = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noRiderProfile, setNoRiderProfile] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('active');
  const [podDelivery, setPodDelivery] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const ridersRes = await ridersAPI.getAll();
      // Resolving OUR OWN riders.id from OUR OWN users.id — these are two
      // separate id spaces (riders has its own primary key, distinct from
      // user_id), same distinction that mattered for the Scheduler fix.
      const myRider = (ridersRes.data.riders || []).find(r => r.user_id === user?.id);
      if (!myRider) {
        setNoRiderProfile(true);
        setDeliveries([]);
        return;
      }
      setNoRiderProfile(false);
      const res = await ridersAPI.getDeliveries(myRider.id);
      setDeliveries(res.data.deliveries || []);
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

  const handleAccept = async (delivery) => {
    setBusyId(delivery.id);
    try {
      await ridersAPI.updateDeliveryStatus(delivery.id, { status: 'accepted' });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not accept delivery');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (delivery) => {
    const reason = window.prompt('Why are you rejecting this delivery? (required)');
    if (reason === null) return; // cancelled the prompt
    if (!reason.trim()) {
      alert('A reason is required to reject a delivery.');
      return;
    }
    setBusyId(delivery.id);
    try {
      await ridersAPI.updateDeliveryStatus(delivery.id, { status: 'rejected', rejection_reason: reason.trim() });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not reject delivery');
    } finally {
      setBusyId(null);
    }
  };

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

  const handlePrint = async (orderId) => {
    setPrintingId(orderId);
    try {
      const res = await ordersAPI.getOne(orderId);
      setPrintOrder(res.data.order);
      setTimeout(() => window.print(), 400);
    } catch (err) {
      alert('Could not load receipt');
    } finally {
      setPrintingId(null);
    }
  };

  const isActiveDelivery = (d) => !CLOSED_STATUSES.includes(d.status);
  const filteredDeliveries = deliveries.filter(d => filter === 'active' ? isActiveDelivery(d) : true);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  if (noRiderProfile) return (
    <div style={{ textAlign: 'center', color: '#9ca3af', padding: '60px 16px' }}>
      No rider profile is linked to your account — contact an admin to get set up.
    </div>
  );

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Deliveries</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { key: 'active', label: `Active (${deliveries.filter(isActiveDelivery).length})` },
          { key: 'all', label: `All (${deliveries.length})` },
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

      {filteredDeliveries.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
          {filter === 'active' ? 'No active deliveries right now.' : 'No deliveries yet.'}
        </div>
      ) : (
        filteredDeliveries
          .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at))
          .map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onAccept={handleAccept}
              onReject={handleReject}
              onStatusUpdate={handleStatusUpdate}
              onRequestPOD={setPodDelivery}
              onPrint={handlePrint}
              printingId={printingId}
              busy={busyId === delivery.id}
            />
          ))
      )}

      {podDelivery && (
        <PODModal
          delivery={podDelivery}
          onClose={() => setPodDelivery(null)}
          onConfirm={async (extra) => {
            await handleStatusUpdate(podDelivery.id, 'delivered', extra);
            setPodDelivery(null);
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

export default PortalDeliveries;
