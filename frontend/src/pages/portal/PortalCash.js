import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI, cashAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: '#fef3c7', color: '#d97706', label: '⏳ Pending Verification' },
    verified: { bg: '#dcfce7', color: '#16a34a', label: '✅ Verified' },
    disputed: { bg: '#fee2e2', color: '#dc2626', label: '⚠️ Disputed' },
    resolved: { bg: '#dbeafe', color: '#1d4ed8', label: '✓ Resolved' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
};

export default function PortalCash() {
  const { user } = useAuth();
  const [rider, setRider] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ridersRes = await ridersAPI.getAll({ limit: 200 });
      const myRider = (ridersRes.data.riders || []).find(r => String(r.user_id) === String(user?.id));
      setRider(myRider || null);
      if (myRider) {
        const res = await cashAPI.getAll({ rider_id: myRider.id, limit: 100 });
        setLogs(res.data.logs || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogPayment = async (disputedLogId) => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      alert('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await cashAPI.create({
        rider_id: rider.id,
        amount: parseFloat(payAmount),
        notes: payNotes || undefined,
        resolves_log_id: disputedLogId,
      });
      setPayingId(null);
      setPayAmount('');
      setPayNotes('');
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error logging payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading…</span></div>;

  if (!rider) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
      <p style={{ color: '#6b7280' }}>No rider profile linked to your account.</p>
    </div>
  );

  const pending = logs.filter(l => l.status === 'pending');
  const verified = logs.filter(l => l.status === 'verified');
  const disputed = logs.filter(l => l.status === 'disputed');
  const resolved = logs.filter(l => l.status === 'resolved');
  const totalPending = pending.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  const totalVerified = verified.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  const shown = activeTab === 'pending' ? pending : activeTab === 'verified' ? verified : activeTab === 'disputed' ? disputed : resolved;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Cash & Payments</h1>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Your COD collections and verification status</p>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: totalPending > 0 ? '#fff7ed' : '#f9f9f8', border: `1px solid ${totalPending > 0 ? '#fed7aa' : '#f3f4f6'}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 500 }}>Pending</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: totalPending > 0 ? '#c2410c' : '#1a1a18', margin: 0 }}>{fmt(totalPending)}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>{pending.length} collection{pending.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 500 }}>Verified</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', margin: 0 }}>{fmt(totalVerified)}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>{verified.length} collection{verified.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {totalPending > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          💡 You have <strong>{fmt(totalPending)}</strong> pending verification. Hand over the cash to your admin to get it verified.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'pending', label: `⏳ Pending (${pending.length})` },
          { key: 'verified', label: `✅ Verified (${verified.length})` },
          { key: 'disputed', label: `⚠️ Disputed (${disputed.length})` },
          { key: 'resolved', label: `✓ Resolved (${resolved.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: activeTab === tab.key ? '#1a1a18' : '#fff',
            color: activeTab === tab.key ? '#fff' : '#6b7280',
            fontSize: 11, fontWeight: 600,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Logs */}
      {shown.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{activeTab === 'pending' ? '✅' : activeTab === 'verified' ? '💰' : activeTab === 'disputed' ? '⚠️' : '✓'}</div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {activeTab === 'pending' ? 'No pending collections' : activeTab === 'verified' ? 'No verified collections yet' : activeTab === 'disputed' ? 'No disputed collections' : 'Nothing resolved yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(log => (
            <div key={log.id} style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{log.order_number || `Order #${log.order_id}`}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', marginTop: 2 }}>{fmt(log.amount)}</div>
                </div>
                <StatusBadge status={log.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                <span>Collected: {log.collected_at ? new Date(log.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                {log.verified_at && <span>Verified: {new Date(log.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>
              {log.notes && <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>📝 {log.notes}</div>}
              {log.status === 'disputed' && (
                <>
                  {log.resolving_log_id ? (
                    <div style={{ marginTop: 8, background: '#eff6ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1d4ed8' }}>
                      💳 You logged {fmt(log.resolving_log_amount)} against this — waiting on admin to confirm.
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, background: '#fee2e2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>
                      ⚠️ Contact your admin about this collection, or log the make-up payment below.
                    </div>
                  )}

                  {payingId === log.id ? (
                    <div style={{ marginTop: 10, background: '#f9f9f8', borderRadius: 10, padding: 12 }}>
                      <input
                        type="number"
                        placeholder="Amount you're paying in (GH₵)"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 8 }}
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={payNotes}
                        onChange={e => setPayNotes(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleLogPayment(log.id)}
                          disabled={submitting}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
                        >
                          {submitting ? 'Submitting…' : 'Submit'}
                        </button>
                        <button
                          onClick={() => { setPayingId(null); setPayAmount(''); setPayNotes(''); }}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    !log.resolving_log_id && (
                      <button
                        onClick={() => { setPayingId(log.id); setPayAmount(''); setPayNotes(''); }}
                        style={{ marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 8, border: '1px solid #1a1a18', background: '#fff', color: '#1a1a18', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        Log Payment
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
