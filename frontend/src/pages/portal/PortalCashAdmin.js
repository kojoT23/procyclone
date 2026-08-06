import React, { useState, useEffect, useCallback } from 'react';
import { cashAPI } from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

export default function PortalCashAdmin() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [actingId, setActingId] = useState(null);
  const [disputeNotes, setDisputeNotes] = useState({});
  const [showDisputeFor, setShowDisputeFor] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (filterStatus) params.status = filterStatus;
      const res = await cashAPI.getAll(params);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const verify = async (id) => {
    setActingId(id);
    try {
      await cashAPI.verify(id);
      fetchLogs();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to verify');
    } finally {
      setActingId(null);
    }
  };

  const dispute = async (id) => {
    const notes = disputeNotes[id] || '';
    setActingId(id);
    try {
      await cashAPI.dispute(id, { notes });
      setShowDisputeFor(null);
      fetchLogs();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to mark as disputed');
    } finally {
      setActingId(null);
    }
  };

  const pendingTotal = logs.filter(l => l.status === 'pending').reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Cash</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{total} logs</p>
      </div>

      {filterStatus === 'pending' && pendingTotal > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: '#c2410c', fontSize: 14 }}>💰 {fmt(pendingTotal)} awaiting verification</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'verified', label: 'Verified' },
          { key: 'disputed', label: 'Disputed' },
          { key: '', label: 'All' },
        ].map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilterStatus(f.key)}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
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
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
          <p style={{ color: '#6b7280' }}>No cash logs match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{log.rider_name || '—'}</div>
                  {log.order_number && (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', marginTop: 2 }}>{log.order_number}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {log.created_at ? new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{fmt(log.amount)}</div>
                  <span style={{
                    display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: log.status === 'verified' ? '#dcfce7' : log.status === 'disputed' ? '#fee2e2' : '#fef3c7',
                    color: log.status === 'verified' ? '#16a34a' : log.status === 'disputed' ? '#dc2626' : '#d97706',
                  }}>
                    {log.status === 'verified' ? '✓ Verified' : log.status === 'disputed' ? '⚠ Disputed' : 'Pending'}
                  </span>
                </div>
              </div>

              {log.notes && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>"{log.notes}"</div>
              )}

              {log.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => verify(log.id)}
                    disabled={actingId === log.id}
                    style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {actingId === log.id ? '…' : '✓ Verify'}
                  </button>
                  <button
                    onClick={() => setShowDisputeFor(showDisputeFor === log.id ? null : log.id)}
                    style={{ flex: 1, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⚠ Dispute
                  </button>
                </div>
              )}

              {showDisputeFor === log.id && (
                <div style={{ marginTop: 10 }}>
                  <input
                    className="form-input"
                    placeholder="Reason for dispute…"
                    value={disputeNotes[log.id] || ''}
                    onChange={e => setDisputeNotes(prev => ({ ...prev, [log.id]: e.target.value }))}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <button
                    onClick={() => dispute(log.id)}
                    disabled={actingId === log.id}
                    style={{ width: '100%', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {actingId === log.id ? 'Submitting…' : 'Confirm Dispute'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
