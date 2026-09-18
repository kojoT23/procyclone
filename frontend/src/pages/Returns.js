import React, { useState, useEffect, useCallback } from 'react';
import { returnsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Returns.css';

/* ─── CSV helper — same pattern as Orders.js ─────────────────────── */
const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && (v.includes(',') || v.includes('"'))
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const STATUS_LABEL = {
  pending_enquiry: 'Awaiting Enquiry',
  pending_disposal_approval: 'Awaiting Disposal Approval',
  resolved: 'Resolved',
};
const STATUS_BADGE = {
  pending_enquiry: 'badge badge-amber',
  pending_disposal_approval: 'badge badge-red',
  resolved: 'badge badge-green',
};

const REASONS = [
  { value: 'customer_unreachable', label: 'Customer unreachable' },
  { value: 'wrong_address', label: 'Wrong address' },
  { value: 'refused', label: 'Customer refused delivery' },
  { value: 'changed_mind', label: 'Customer changed mind' },
  { value: 'damaged_in_transit', label: 'Damaged in transit' },
  { value: 'other', label: 'Other' },
];

/* ── Enquiry form modal — reason, condition, notes, required photo ── */
const PHOTO_SLOTS = [
  { key: 'item', label: 'Photo of the item' },
  { key: 'damage', label: 'Close-up of damage / packaging' },
  { key: 'label', label: 'Shipping label / order slip' },
];

const EnquiryModal = ({ ret, onClose, onSubmitted }) => {
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState({});
  const [declaration, setDeclaration] = useState(false);
  const [quantities, setQuantities] = useState(
    (ret.items_detail || []).reduce((acc, item) => {
      acc[item.product_id] = item.quantity_ordered;
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRefs = React.useRef({});

  const items = ret.items_detail || [];
  const hasMismatch = items.some(i => (quantities[i.product_id] ?? 0) < i.quantity_ordered);

  const handlePhoto = (slotKey, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotos(p => ({ ...p, [slotKey]: reader.result }));
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Return Enquiry</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="text-muted" style={{ marginTop: '-8px', marginBottom: '18px', fontSize: '13px' }}>
          {ret.order_number || `#${ret.order_id}`} · {ret.customer_name}
        </p>

        <div className="form-group">
          <label className="form-label">Items received</label>
          {items.map(item => (
            <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{item.product_name}</div>
                <div className="text-muted" style={{ fontSize: '12px' }}>Ordered: {item.quantity_ordered}</div>
              </div>
              <input
                type="number"
                min="0"
                max={item.quantity_ordered}
                className="form-input"
                style={{ width: '80px' }}
                value={quantities[item.product_id] ?? ''}
                onChange={e => setQuantities(q => ({ ...q, [item.product_id]: Math.min(parseInt(e.target.value) || 0, item.quantity_ordered) }))}
              />
            </div>
          ))}
          {hasMismatch && (
            <p className="form-error" style={{ marginTop: '8px' }}>
              ⚠ Quantity short of what was ordered — this will be escalated to disposal approval regardless of condition.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Reason</label>
          <select className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Condition</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button type="button" onClick={() => setCondition('sellable')}
              className={condition === 'sellable' ? 'btn btn-primary' : 'btn btn-secondary'}>✓ Sellable</button>
            <button type="button" onClick={() => setCondition('damaged')}
              className={condition === 'damaged' ? 'btn btn-danger' : 'btn btn-secondary'}>✕ Damaged</button>
            <button type="button" onClick={() => setCondition('missing')}
              className={condition === 'missing' ? 'btn btn-danger' : 'btn btn-secondary'}>? Missing</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="What happened, condition details…"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Photo evidence (at least one required)</label>
          {PHOTO_SLOTS.map(slot => (
            <div key={slot.key} style={{ marginBottom: '10px' }}>
              <input
                ref={el => fileInputRefs.current[slot.key] = el}
                type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
                onChange={e => handlePhoto(slot.key, e)}
              />
              {photos[slot.key] ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <img src={photos[slot.key]} alt={slot.label}
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{slot.label}</div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRefs.current[slot.key]?.click()}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[slot.key]?.click()}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '14px', border: '2px dashed var(--border)', background: 'var(--bg)', textAlign: 'left' }}
                >
                  📷 {slot.label}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={declaration} onChange={e => setDeclaration(e.target.checked)} style={{ marginTop: '2px' }} />
            I personally received and inspected this item, and the details above are accurate to the best of my knowledge.
          </label>
        </div>

        {error && <p className="form-error" style={{ marginBottom: '14px' }}>{error}</p>}

        <div className="form-row">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Enquiry'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Disposal approval modal — admin/manager only ── */
const DisposalModal = ({ ret, onClose, onSubmitted }) => {
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!resolution || !notes.trim()) {
      setError('A resolution and notes are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await returnsAPI.approveDisposal(ret.id, { resolution, notes });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Error recording disposal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Approve Disposal</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="text-muted" style={{ marginTop: '-8px', marginBottom: '18px', fontSize: '13px' }}>
          {ret.order_number || `#${ret.order_id}`} · flagged {ret.condition} by {ret.enquiry_completed_by_name || 'staff'}
        </p>

        {ret.quantity_mismatch && (
          <div className="card-flat" style={{ padding: '10px 12px', marginBottom: '14px', border: '1px solid var(--red)', background: '#fef2f2' }}>
            <strong style={{ fontSize: '13px', color: 'var(--red)' }}>⚠ Quantity mismatch</strong>
            {(ret.items_detail || []).map(item => (
              <div key={item.product_id} style={{ fontSize: '12.5px', marginTop: '4px' }}>
                {item.product_name}: {item.quantity_received} received of {item.quantity_ordered} ordered
              </div>
            ))}
          </div>
        )}

        {ret.photos?.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {ret.photos.map((p, idx) => (
              <img key={idx} src={p} alt={`Evidence ${idx + 1}`}
                style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
            ))}
          </div>
        )}
        {ret.enquiry_notes && (
          <div className="card-flat" style={{ padding: '10px 12px', marginBottom: '18px', fontSize: '13px' }}>
            "{ret.enquiry_notes}"
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Resolution</label>
          <select className="form-input" value={resolution} onChange={e => setResolution(e.target.value)}>
            <option value="">Select…</option>
            <option value="written_off">Write off (unsellable, discard)</option>
            <option value="returned_to_supplier">Return to supplier</option>
            <option value="restocked_after_review">Override — actually sellable, restock</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Decision reasoning, for the audit trail…"
          />
        </div>

        {error && <p className="form-error" style={{ marginBottom: '14px' }}>{error}</p>}

        <div className="form-row">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Returns = () => {
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'manager'].includes(user?.role);

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [enquiryTarget, setEnquiryTarget] = useState(null);
  const [disposalTarget, setDisposalTarget] = useState(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await returnsAPI.getAll(params);
      setReturns(res.data.returns);
    } catch {
      // list stays empty; empty-state below covers it
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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

  const exportCSV = () => {
    downloadCSV(
      returns.map(r => ({
        'Order #':          r.order_number || `#${r.order_id}`,
        Customer:           r.customer_name || '',
        Phone:              r.customer_phone || '',
        Items:              r.item_summary || '',
        Status:             STATUS_LABEL[r.status] || r.status,
        Reason:             r.reason?.replace(/_/g, ' ') || '',
        Condition:          r.condition || '',
        'Assigned To':      r.assigned_to_name || '',
        Rider:              r.rider_name || '',
        'Enquiry Notes':    r.enquiry_notes || '',
        'Enquiry By':       r.enquiry_completed_by_name || '',
        'Enquiry At':       r.enquiry_completed_at ? new Date(r.enquiry_completed_at).toLocaleString('en-GB') : '',
        Resolution:         r.resolution?.replace(/_/g, ' ') || '',
        'Disposal Notes':   r.disposal_notes || '',
        'Disposed By':      r.disposed_by_name || '',
        'Disposed At':      r.disposed_at ? new Date(r.disposed_at).toLocaleString('en-GB') : '',
        'Payment Method':   r.payment_method || '',
        'Refund Status':    r.refund_status || '',
        'Quantity Mismatch': r.quantity_mismatch ? 'YES' : 'No',
        'Items Received':   (r.items_detail || []).map(i => `${i.product_name}: ${i.quantity_received ?? '—'}/${i.quantity_ordered}`).join('; '),
        'Declaration Confirmed': r.declaration_confirmed ? 'Yes' : 'No',
        'Photo Count':      r.photos?.length || 0,
      })),
      `returns-audit-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 100);
  };

  return (
    <div>
      {/* Hidden print/PDF area — a formal audit document */}
      <div className="print-only">
        <div className="returns-audit-page">
          <h1 style={{ margin: '0 0 4px' }}>Returns Audit Report</h1>
          <p style={{ margin: '0 0 20px', color: '#475569' }}>
            Generated {new Date().toLocaleString('en-GB')}
            {statusFilter ? ` · Filtered: ${STATUS_LABEL[statusFilter]}` : ''}
            {' · '}{returns.length} record{returns.length === 1 ? '' : 's'}
          </p>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items (Received/Ordered)</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Condition</th>
                <th>Evidence</th>
                <th>Enquiry By / At</th>
                <th>Resolution</th>
                <th>Disposed By / At</th>
                <th>Refund</th>
              </tr>
            </thead>
            <tbody>
              {returns.map(r => (
                <tr key={r.id}>
                  <td>{r.order_number || `#${r.order_id}`}</td>
                  <td>{r.customer_name}<br />{r.customer_phone}</td>
                  <td>
                    {(r.items_detail || []).map(i => (
                      <div key={i.product_id} style={{ color: i.quantity_received < i.quantity_ordered ? '#dc2626' : undefined }}>
                        {i.product_name}: {i.quantity_received ?? '—'}/{i.quantity_ordered}
                      </div>
                    ))}
                    {!r.items_detail?.length && (r.item_summary || '—')}
                  </td>
                  <td>{STATUS_LABEL[r.status]}</td>
                  <td>{r.reason?.replace(/_/g, ' ') || '—'}</td>
                  <td>{r.condition || '—'}{r.quantity_mismatch ? ' (short)' : ''}</td>
                  <td>
                    {(r.photos || []).map((p, idx) => (
                      <img key={idx} src={p} alt="" style={{ width: '36px', height: '36px', objectFit: 'cover', marginRight: '3px' }} />
                    ))}
                    {!r.photos?.length && '—'}
                  </td>
                  <td>{r.enquiry_completed_by_name || '—'}<br />{r.enquiry_completed_at ? new Date(r.enquiry_completed_at).toLocaleString('en-GB') : ''}</td>
                  <td>{r.resolution?.replace(/_/g, ' ') || '—'}</td>
                  <td>{r.disposed_by_name || '—'}<br />{r.disposed_at ? new Date(r.disposed_at).toLocaleString('en-GB') : ''}</td>
                  <td>{r.refund_status === 'none' ? '—' : r.refund_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen UI */}
      <div className="no-print">
      <div className="page-header">
        <div>
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">Failed deliveries — enquiry, disposal, and refund audit trail</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨 Print / Save as PDF</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '220px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending_enquiry">Awaiting Enquiry</option>
            <option value="pending_disposal_approval">Awaiting Disposal Approval</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><p className="loading-text">Loading returns…</p></div>
      ) : returns.length === 0 ? (
        <div className="empty-state"><h3>No returns</h3><p>Nothing matches this filter.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Refund</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id}>
                    <td>{r.order_number || `#${r.order_id}`}</td>
                    <td>{r.customer_name}<div className="text-muted">{r.customer_phone}</div></td>
                    <td>{r.item_summary || '—'}</td>
                    <td>
                      <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>
                      {r.condition && <div className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>{r.condition}</div>}
                      {r.quantity_mismatch && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--red)', fontWeight: 700 }}>⚠ Qty short</div>}
                    </td>
                    <td>{r.assigned_to_name || '—'}</td>
                    <td>
                      {r.refund_status === 'none' ? <span className="text-muted">—</span> :
                       r.refund_status === 'refunded' ? <span className="badge badge-purple">Refunded</span> :
                       <span className="badge badge-amber">Pending</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {r.status === 'pending_enquiry' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setEnquiryTarget(r)}>
                            Complete Enquiry
                          </button>
                        )}
                        {r.status === 'pending_disposal_approval' && isAdmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => setDisposalTarget(r)}>
                            Review Disposal
                          </button>
                        )}
                        {r.refund_status === 'pending' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleConfirmRefund(r.id)}>
                            Confirm Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {enquiryTarget && (
        <EnquiryModal
          ret={enquiryTarget}
          onClose={() => setEnquiryTarget(null)}
          onSubmitted={() => { setEnquiryTarget(null); fetchReturns(); }}
        />
      )}
      {disposalTarget && (
        <DisposalModal
          ret={disposalTarget}
          onClose={() => setDisposalTarget(null)}
          onSubmitted={() => { setDisposalTarget(null); fetchReturns(); }}
        />
      )}
      </div>
    </div>
  );
};

export default Returns;
