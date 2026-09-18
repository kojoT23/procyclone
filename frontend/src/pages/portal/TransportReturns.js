import React, { useState, useEffect, useCallback } from 'react';
import { returnsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABEL = {
  pending_enquiry: 'Awaiting Enquiry',
  pending_disposal_approval: 'Awaiting Disposal Approval',
  resolved: 'Resolved',
};
const REASONS = [
  { value: 'customer_unreachable', label: 'Customer unreachable' },
  { value: 'wrong_address', label: 'Wrong address' },
  { value: 'refused', label: 'Customer refused delivery' },
  { value: 'changed_mind', label: 'Customer changed mind' },
  { value: 'damaged_in_transit', label: 'Damaged in transit' },
  { value: 'other', label: 'Other' },
];
const PHOTO_SLOTS = [
  { key: 'item', label: 'Photo of the item' },
  { key: 'damage', label: 'Close-up of damage / packaging' },
  { key: 'label', label: 'Shipping label / order slip' },
];

const badgeStyle = (bg, color) => ({
  background: bg, color, border: 'none', borderRadius: 10,
  padding: '4px 10px', fontSize: 12, fontWeight: 700, display: 'inline-block',
});
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#374151' };

const sheetWrap = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 };
const sheetBody = { background: '#fff', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxHeight: '90vh', overflowY: 'auto' };

/* ── Enquiry form ── */
const EnquiryModal = ({ ret, onClose, onSubmitted }) => {
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState({});
  const [declaration, setDeclaration] = useState(false);
  const [quantities, setQuantities] = useState(
    (ret.items_detail || []).reduce((acc, i) => { acc[i.product_id] = i.quantity_ordered; return acc; }, {})
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRefs = React.useRef({});

  const items = ret.items_detail || [];
  const hasMismatch = items.some(i => (quantities[i.product_id] ?? 0) < i.quantity_ordered);

  const handlePhoto = (key, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotos(p => ({ ...p, [key]: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const photoList = Object.values(photos).filter(Boolean);
    if (!reason || !condition || !notes.trim() || photoList.length === 0 || !declaration) {
      setError('Reason, condition, notes, at least one photo, and the declaration are all required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await returnsAPI.submitEnquiry(ret.id, {
        reason, condition, notes, photos: photoList, declaration,
        items: items.map(i => ({ product_id: i.product_id, quantity_received: quantities[i.product_id] ?? 0 })),
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting enquiry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={sheetBody} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px' }}>Return Enquiry</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>
          {ret.order_number || `#${ret.order_id}`} · {ret.customer_name}
        </p>

        <label style={labelStyle}>Items received</label>
        {items.map(item => (
          <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.product_name}</div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>Ordered: {item.quantity_ordered}</div>
            </div>
            <input type="number" min="0" max={item.quantity_ordered}
              style={{ ...inputStyle, width: 70 }}
              value={quantities[item.product_id] ?? ''}
              onChange={e => setQuantities(q => ({ ...q, [item.product_id]: Math.min(parseInt(e.target.value) || 0, item.quantity_ordered) }))}
            />
          </div>
        ))}
        {hasMismatch && (
          <p style={{ color: '#dc2626', fontSize: 12.5, marginTop: 8 }}>
            ⚠ Quantity short — this will be escalated to disposal approval.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Reason</label>
          <select style={inputStyle} value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Condition</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {['sellable', 'damaged', 'missing'].map(c => (
              <button key={c} type="button" onClick={() => setCondition(c)}
                style={{
                  padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                  border: condition === c ? '2px solid #111827' : '1px solid #e5e7eb',
                  background: condition === c ? '#111827' : '#fff',
                  color: condition === c ? '#fff' : '#374151',
                }}>{c === 'sellable' ? '✓ Sellable' : c === 'damaged' ? '✕ Damaged' : '? Missing'}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="What happened, condition details…" />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Photo evidence (at least one required)</label>
          {PHOTO_SLOTS.map(slot => (
            <div key={slot.key} style={{ marginBottom: 8 }}>
              <input ref={el => fileRefs.current[slot.key] = el} type="file" accept="image/jpeg,image/png"
                style={{ display: 'none' }} onChange={e => handlePhoto(slot.key, e)} />
              {photos[slot.key] ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <img src={photos[slot.key]} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{slot.label}</div>
                    <button type="button" onClick={() => fileRefs.current[slot.key]?.click()}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRefs.current[slot.key]?.click()}
                  style={{ width: '100%', padding: 12, border: '2px dashed #d1d5db', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                  📷 {slot.label}
                </button>
              )}
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={declaration} onChange={e => setDeclaration(e.target.checked)} style={{ marginTop: 2 }} />
          I personally received and inspected this item, and the details above are accurate.
        </label>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Submitting…' : 'Submit Enquiry'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Disposal approval — admin/manager only ── */
const DisposalModal = ({ ret, onClose, onSubmitted }) => {
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!resolution || !notes.trim()) { setError('A resolution and notes are required.'); return; }
    setSaving(true); setError('');
    try {
      await returnsAPI.approveDisposal(ret.id, { resolution, notes });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Error recording disposal');
    } finally { setSaving(false); }
  };

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={sheetBody} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px' }}>Approve Disposal</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 14px' }}>
          {ret.order_number || `#${ret.order_id}`} · flagged {ret.condition} by {ret.enquiry_completed_by_name || 'staff'}
        </p>

        {ret.quantity_mismatch && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <strong style={{ fontSize: 13, color: '#dc2626' }}>⚠ Quantity mismatch</strong>
            {(ret.items_detail || []).map(i => (
              <div key={i.product_id} style={{ fontSize: 12.5, marginTop: 4 }}>
                {i.product_name}: {i.quantity_received} of {i.quantity_ordered}
              </div>
            ))}
          </div>
        )}
        {ret.photos?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {ret.photos.map((p, idx) => (
              <img key={idx} src={p} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
            ))}
          </div>
        )}
        {ret.enquiry_notes && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>"{ret.enquiry_notes}"</div>
        )}

        <label style={labelStyle}>Resolution</label>
        <select style={inputStyle} value={resolution} onChange={e => setResolution(e.target.value)}>
          <option value="">Select…</option>
          <option value="written_off">Write off (unsellable, discard)</option>
          <option value="returned_to_supplier">Return to supplier</option>
          <option value="restocked_after_review">Override — actually sellable, restock</option>
        </select>

        <label style={{ ...labelStyle, marginTop: 12 }}>Notes</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Decision reasoning, for the audit trail…" />

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TransportReturns = () => {
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'manager'].includes(user?.role);

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [enquiryTarget, setEnquiryTarget] = useState(null);
  const [disposalTarget, setDisposalTarget] = useState(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const res = await returnsAPI.getAll(params);
      setReturns(res.data.returns);
    } catch {
      // list stays empty; empty-state below covers it
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleConfirmRefund = async (id) => {
    if (!window.confirm('Confirm the refund has been sent to the customer?')) return;
    try {
      await returnsAPI.confirmRefund(id);
      fetchReturns();
    } catch (err) {
      alert(err.response?.data?.message || 'Error confirming refund');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>Returns</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Failed deliveries — enquiry &amp; disposal</p>

      <select value={filter} onChange={e => setFilter(e.target.value)}
        style={{ marginBottom: 16, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <option value="">All</option>
        <option value="pending_enquiry">Awaiting Enquiry</option>
        <option value="pending_disposal_approval">Awaiting Disposal Approval</option>
        <option value="resolved">Resolved</option>
      </select>

      {loading ? (
        <div>Loading…</div>
      ) : returns.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>No returns match this filter.</div>
      ) : (
        returns.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{r.order_number || `#${r.order_id}`}</strong>
              <span style={badgeStyle(
                r.status === 'resolved' ? '#f0fdf4' : r.status === 'pending_disposal_approval' ? '#fef2f2' : '#fffbeb',
                r.status === 'resolved' ? '#15803d' : r.status === 'pending_disposal_approval' ? '#dc2626' : '#d97706'
              )}>{STATUS_LABEL[r.status]}</span>
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}>{r.customer_name} · {r.customer_phone}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{r.item_summary || '—'}</div>
            {r.quantity_mismatch && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>⚠ Quantity short</div>}
            {r.refund_status !== 'none' && (
              <div style={{ marginTop: 6 }}>
                <span style={badgeStyle(r.refund_status === 'refunded' ? '#f5f3ff' : '#fffbeb', r.refund_status === 'refunded' ? '#7c3aed' : '#d97706')}>
                  {r.refund_status === 'refunded' ? '↩ Refunded' : 'Refund Pending'}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {r.status === 'pending_enquiry' && (
                <button onClick={() => setEnquiryTarget(r)}
                  style={{ background: '#eef2ff', color: '#4338ca', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Complete Enquiry
                </button>
              )}
              {r.status === 'pending_disposal_approval' && isAdmin && (
                <button onClick={() => setDisposalTarget(r)}
                  style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Review Disposal
                </button>
              )}
              {r.refund_status === 'pending' && (
                <button onClick={() => handleConfirmRefund(r.id)}
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Confirm Refund
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {enquiryTarget && (
        <EnquiryModal ret={enquiryTarget} onClose={() => setEnquiryTarget(null)}
          onSubmitted={() => { setEnquiryTarget(null); fetchReturns(); }} />
      )}
      {disposalTarget && (
        <DisposalModal ret={disposalTarget} onClose={() => setDisposalTarget(null)}
          onSubmitted={() => { setDisposalTarget(null); fetchReturns(); }} />
      )}
    </div>
  );
};

export default TransportReturns;
