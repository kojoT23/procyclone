import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const FAILURE_REASONS = [
  'Customer not home',
  'Wrong address',
  'Customer refused delivery',
  'Customer requested reschedule',
  'Item damaged in transit',
  'Security denied access',
  'Other',
];

const ISSUE_TYPES = [
  { key: 'failed', label: '❌ Failed Delivery', color: '#dc2626' },
  { key: 'returned', label: '↩️ Returned to Sender', color: '#f59e0b' },
  { key: 'damaged', label: '📦 Item Damaged', color: '#7c3aed' },
];

const StatusBadge = ({ status }) => {
  const map = {
    pending:          { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
    assigned:         { bg: '#dbeafe', color: '#1d4ed8', label: 'Assigned' },
    picked_up:        { bg: '#ede9fe', color: '#7c3aed', label: 'Picked Up' },
    out_for_delivery: { bg: '#fef3c7', color: '#d97706', label: 'Out for Delivery' },
    delivered:        { bg: '#dcfce7', color: '#16a34a', label: '✅ Delivered' },
    failed:           { bg: '#fee2e2', color: '#dc2626', label: '❌ Failed' },
    returned:         { bg: '#fef3c7', color: '#f59e0b', label: '↩️ Returned' },
    damaged:          { bg: '#ede9fe', color: '#7c3aed', label: '📦 Damaged' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
};

export default function PortalDeliveries() {
  const { user } = useAuth();
  const [rider, setRider] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  // Issue reporting modal
  const [showIssue, setShowIssue] = useState(null);
  const [issueType, setIssueType] = useState('failed');
  const [failureReason, setFailureReason] = useState('Customer not home');
  const [issueNotes, setIssueNotes] = useState('');

  // Delivery proof modal
  const [showProof, setShowProof] = useState(null);
  const [proofNote, setProofNote] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ridersRes = await ridersAPI.getAll({ limit: 200 });
      const myRider = (ridersRes.data.riders || []).find(r => String(r.user_id) === String(user?.id));
      setRider(myRider || null);
      if (myRider) {
        const res = await API.get(`/riders/${myRider.id}/deliveries`);
        setDeliveries(res.data.deliveries || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (deliveryId, status, extra = {}) => {
    setUpdating(deliveryId);
    try {
      await ridersAPI.updateDeliveryStatus(deliveryId, { status, ...extra });
      fetchData();
      setShowIssue(null);
      setShowProof(null);
      setIssueNotes('');
      setProofNote('');
    } catch (e) { console.error(e); }
    setUpdating(null);
  };

  const sendWhatsAppReceipt = (d) => {
    const phone = d.customer_phone?.replace(/\D/g, '');
    const intl = phone?.startsWith('0') ? '233' + phone.slice(1) : phone;
    const msg = `Hello ${d.customer_name}! Your order ${d.order_number} has been delivered. Amount: ${fmt(d.total_amount)}. Thank you for choosing Shorewinds! 🚲`;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openMaps = (address) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading…</span></div>;

  if (!rider) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
      <p style={{ color: '#6b7280' }}>No rider profile linked.</p>
    </div>
  );

  const active = deliveries.filter(d => !['delivered', 'failed', 'returned', 'damaged'].includes(d.status));
  const completed = deliveries.filter(d => d.status === 'delivered');
  const issues = deliveries.filter(d => ['failed', 'returned', 'damaged'].includes(d.status));
  const shown = activeTab === 'active' ? active : activeTab === 'completed' ? completed : issues;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Deliveries</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Manage your deliveries and report issues</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Active', value: active.length, color: '#1d4ed8' },
          { label: 'Delivered', value: completed.length, color: '#16a34a' },
          { label: 'Issues', value: issues.length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'active', label: `📦 Active (${active.length})` },
          { key: 'completed', label: `✅ Done (${completed.length})` },
          { key: 'issues', label: `⚠️ Issues (${issues.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: activeTab === tab.key ? '#1a1a18' : '#fff',
            color: activeTab === tab.key ? '#fff' : '#6b7280',
            fontSize: 11, fontWeight: 600,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deliveries list */}
      {shown.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {activeTab === 'active' ? '🎉' : activeTab === 'completed' ? '📋' : '✅'}
          </div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {activeTab === 'active' ? 'No active deliveries' : activeTab === 'completed' ? 'No completed deliveries' : 'No issues reported'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(d => (
            <div key={d.id} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Card header */}
              <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{d.order_number}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', marginTop: 2 }}>{d.customer_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📍 {d.delivery_address || d.customer_address || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={d.status} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e', marginTop: 6 }}>{fmt(d.total_amount)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: d.payment_method === 'cod' ? '#fee2e2' : '#dcfce7',
                    color: d.payment_method === 'cod' ? '#dc2626' : '#16a34a',
                  }}>
                    {d.payment_method === 'cod' ? '💵 COLLECT CASH' : '✅ PREPAID'}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{expanded === d.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded */}
              {expanded === d.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                  {/* Customer info */}
                  <div style={{ background: '#f9f9f8', borderRadius: 10, padding: '12px 14px', margin: '12px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{d.customer_name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={`tel:${d.customer_phone}`} style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, textDecoration: 'none', background: '#f0fdf4', padding: '6px 12px', borderRadius: 8 }}>
                        📞 Call
                      </a>
                      {(d.delivery_address || d.customer_address) && (
                        <button onClick={() => openMaps(d.delivery_address || d.customer_address)} style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600, background: '#eff6ff', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                          🗺️ Navigate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order items */}
                  {d.items?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', margin: '0 0 8px' }}>Items</p>
                      {d.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < d.items.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 13 }}>
                          <span>×{item.quantity} {item.product_name}</span>
                          <span style={{ fontWeight: 600 }}>{fmt(item.total_price)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '2px solid #f3f4f6', fontWeight: 700, fontSize: 14 }}>
                        <span>Total</span>
                        <span style={{ color: '#22c55e' }}>{fmt(d.total_amount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Issue details if reported */}
                  {d.failure_reason && (
                    <div style={{ background: '#fee2e2', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#dc2626' }}>
                      <strong>Issue:</strong> {d.failure_reason}
                      {d.delivery_notes && <div style={{ marginTop: 4 }}>📝 {d.delivery_notes}</div>}
                    </div>
                  )}

                  {/* Proof note if delivered */}
                  {d.proof_note && (
                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#16a34a' }}>
                      ✅ {d.proof_note}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {d.status === 'assigned' && (
                      <button style={{ width: '100%', padding: 14, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => updateStatus(d.id, 'picked_up')} disabled={updating === d.id}>
                        {updating === d.id ? 'Updating…' : '📦 Mark as Picked Up'}
                      </button>
                    )}
                    {d.status === 'picked_up' && (
                      <button style={{ width: '100%', padding: 14, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => updateStatus(d.id, 'out_for_delivery')} disabled={updating === d.id}>
                        {updating === d.id ? 'Updating…' : '🏍️ Out for Delivery'}
                      </button>
                    )}
                    {d.status === 'out_for_delivery' && (
                      <>
                        <button style={{ width: '100%', padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => setShowProof(d)}>
                          ✅ Mark as Delivered
                        </button>
                        <button style={{ width: '100%', padding: 14, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => { setShowIssue(d); setIssueType('failed'); }}>
                          ⚠️ Report an Issue
                        </button>
                      </>
                    )}
                    {d.status === 'delivered' && (
                      <button style={{ width: '100%', padding: 12, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => sendWhatsAppReceipt(d)}>
                        💬 Send WhatsApp Receipt
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Proof of delivery modal */}
      {showProof && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Confirm Delivery</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Add a note about the delivery (optional)</p>
            <input
              className="form-input"
              placeholder="e.g. Left with security, Customer received in person…"
              value={proofNote}
              onChange={e => setProofNote(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowProof(null)} style={{ flex: 1, padding: 14, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => updateStatus(showProof.id, 'delivered', { proof_note: proofNote })}
                disabled={updating === showProof.id}
                style={{ flex: 2, padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {updating === showProof.id ? 'Saving…' : '✅ Confirm Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue reporting modal */}
      {showIssue && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Report Issue</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>{showIssue.order_number} — {showIssue.customer_name}</p>

            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Issue Type</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {ISSUE_TYPES.map(type => (
                <button key={type.key} onClick={() => setIssueType(type.key)} style={{
                  padding: '12px 16px', borderRadius: 10, border: `2px solid ${issueType === type.key ? type.color : '#f3f4f6'}`,
                  background: issueType === type.key ? type.color + '15' : '#fff',
                  color: issueType === type.key ? type.color : '#6b7280',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                }}>
                  {type.label}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Reason</p>
            <select className="form-input" value={failureReason} onChange={e => setFailureReason(e.target.value)} style={{ marginBottom: 12 }}>
              {FAILURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Additional Notes</p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Any additional details about the issue…"
              value={issueNotes}
              onChange={e => setIssueNotes(e.target.value)}
              style={{ marginBottom: 16, resize: 'none' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowIssue(null)} style={{ flex: 1, padding: 14, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => updateStatus(showIssue.id, issueType, { failure_reason: failureReason, issue_type: issueType, delivery_notes: issueNotes })}
                disabled={updating === showIssue.id}
                style={{ flex: 2, padding: 14, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {updating === showIssue.id ? 'Saving…' : 'Submit Issue Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
