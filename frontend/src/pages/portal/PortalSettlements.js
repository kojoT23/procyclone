import React, { useState, useEffect, useCallback } from 'react';
import { settlementsAPI } from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const STATUS_COLORS = {
  declared:  { bg: '#fef3c7', text: '#d97706', label: 'Awaiting Review' },
  approved:  { bg: '#dcfce7', text: '#16a34a', label: 'Approved' },
  disputed:  { bg: '#fee2e2', text: '#dc2626', label: 'Disputed' },
};

export default function PortalSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('declared');
  const [expandedId, setExpandedId] = useState(null);
  const [approving, setApproving] = useState(null);
  const [approvalForm, setApprovalForm] = useState({});

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 30 };
      if (filterStatus) params.status = filterStatus;
      const res = await settlementsAPI.getAll(params);
      setSettlements(res.data.settlements || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  const handleApprove = async (settlement) => {
    const form = approvalForm[settlement.id] || {};
    const amount = parseFloat(form.approved_amount);
    if (!amount || amount < 0) {
      alert('Enter the actual counted amount');
      return;
    }
    setApproving(settlement.id);
    try {
      await settlementsAPI.approve(settlement.id, {
        approved_amount: amount,
        dispute_notes: form.dispute_notes || undefined,
      });
      setExpandedId(null);
      setApprovalForm(prev => { const n = { ...prev }; delete n[settlement.id]; return n; });
      fetchSettlements();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to process settlement');
    } finally {
      setApproving(null);
    }
  };

  const updateForm = (id, field, value) => {
    setApprovalForm(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Settlements</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{total} total</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: 'declared', label: 'Awaiting Review' },
          { key: 'approved', label: 'Approved' },
          { key: 'disputed', label: 'Disputed' },
          { key: '', label: 'All' },
        ].map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilterStatus(f.key)}
            style={{
              flex: 1, padding: '6px 4px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: filterStatus === f.key ? '#1a1a18' : '#fff',
              color: filterStatus === f.key ? '#fff' : '#6b7280',
              boxShadow: filterStatus === f.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : settlements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧮</div>
          <p style={{ color: '#6b7280' }}>No settlements in this category.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {settlements.map(s => {
            const colors = STATUS_COLORS[s.status] || { bg: '#f1f5f9', text: '#475569', label: s.status };
            const isExpanded = expandedId === s.id;
            const form = approvalForm[s.id] || {};
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div onClick={() => setExpandedId(isExpanded ? null : s.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{s.rider_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {s.order_count} order{s.order_count !== 1 ? 's' : ''} · {new Date(s.declared_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                    {s.approved_by_name && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>by {s.approved_by_name}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>{fmt(s.declared_amount)}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: colors.bg, color: colors.text }}>
                      {colors.label}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    {s.status === 'declared' ? (
                      <>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
                          Rider declared <strong>{fmt(s.declared_amount)}</strong>. Enter the actual amount you counted to approve or flag a dispute.
                        </p>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                          Actual amount counted
                        </label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          placeholder={`Expected: ${fmt(s.declared_amount)}`}
                          value={form.approved_amount || ''}
                          onChange={e => updateForm(s.id, 'approved_amount', e.target.value)}
                          style={{ width: '100%', marginBottom: 8 }}
                        />
                        {form.approved_amount && parseFloat(form.approved_amount) !== parseFloat(s.declared_amount) && (
                          <>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 4 }}>
                              ⚠ Amount doesn't match — add dispute notes
                            </label>
                            <input
                              className="form-input"
                              placeholder="Reason for discrepancy…"
                              value={form.dispute_notes || ''}
                              onChange={e => updateForm(s.id, 'dispute_notes', e.target.value)}
                              style={{ width: '100%', marginBottom: 8 }}
                            />
                          </>
                        )}
                        <button
                          onClick={() => handleApprove(s)}
                          disabled={approving === s.id}
                          style={{ width: '100%', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {approving === s.id ? 'Processing…' : 'Confirm & Process'}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        {s.approved_amount && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>Counted amount</span>
                            <span style={{ fontWeight: 700, color: '#1a1a18' }}>{fmt(s.approved_amount)}</span>
                          </div>
                        )}
                        {s.dispute_notes && (
                          <div style={{ marginTop: 6, padding: '8px 10px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                            {s.dispute_notes}
                          </div>
                        )}
                      </div>
                    )}
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
