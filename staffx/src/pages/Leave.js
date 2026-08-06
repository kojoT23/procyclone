import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const LEAVE_TYPE_LABELS = { annual: '🌴 Annual', sick: '🤒 Sick', unpaid: '📋 Unpaid', other: '📝 Other' };

const STATUS_COLORS = {
  pending:  { bg: '#fef3c7', color: '#d97706' },
  approved: { bg: '#dcfce7', color: '#16a34a' },
  rejected: { bg: '#fee2e2', color: '#dc2626' },
};
const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'uppercase' }}>{status}</span>;
};

const daysBetween = (start, end) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.round((e - s) / 86400000) + 1;
};

/* ═══════════════════════════════════════════════════════════════
   Staff view — request + cancel own requests
═══════════════════════════════════════════════════════════════ */
function MyLeave() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrAPI.getMyLeaveRequests();
      setRequests(res.data.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openAdd = () => {
    setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) return alert('Start and end date are required');
    if (form.start_date > form.end_date) return alert('Start date must be before end date');
    try {
      setSaving(true);
      await hrAPI.createLeaveRequest(form);
      setShowModal(false);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting request');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (r) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await hrAPI.cancelMyLeaveRequest(r.id);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling request');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Request Leave
        </button>
      </div>

      {requests.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌴</div>
          <p style={{ color: '#6b7280' }}>No leave requests yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{fmtDate(r.start_date)} – {fmtDate(r.end_date)} · {daysBetween(r.start_date, r.end_date)} day(s)</div>
                  {r.reason && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{r.reason}</div>}
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.status === 'pending' && (
                <button onClick={() => handleCancel(r)} style={{ marginTop: 10, width: '100%', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel Request
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Request Leave</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Leave Type</label>
            <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Start Date *</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>End Date *</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Reason</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional" style={{ width: '100%', marginBottom: 16, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Admin view — approve / reject all requests
═══════════════════════════════════════════════════════════════ */
function AdminLeave() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [acting, setActing] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter ? { status: filter } : {};
      const res = await hrAPI.getAllLeaveRequests(params);
      setRequests(res.data.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (r) => {
    setActing(r.id);
    try {
      await hrAPI.approveLeaveRequest(r.id);
      fetchRequests();
    } catch {
      alert('Error approving request');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (r) => {
    setActing(r.id);
    try {
      await hrAPI.rejectLeaveRequest(r.id);
      fetchRequests();
    } catch {
      alert('Error rejecting request');
    } finally {
      setActing(null);
    }
  };

  const filters = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: '', label: 'All' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {filters.map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: filter === f.key ? '#1a1a18' : '#fff', color: filter === f.key ? '#fff' : '#6b7280',
              boxShadow: filter === f.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌴</div>
          <p style={{ color: '#6b7280' }}>No {filter || ''} leave requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{r.user_name} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12, textTransform: 'capitalize' }}>({r.user_role?.replace('_', ' ')})</span></div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{fmtDate(r.start_date)} – {fmtDate(r.end_date)} · {daysBetween(r.start_date, r.end_date)} day(s)</div>
                  {r.reason && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{r.reason}</div>}
                  {r.approved_by_name && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.approved_by_name}</div>}
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                  <button onClick={() => handleApprove(r)} disabled={acting === r.id} style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Approve</button>
                  <button onClick={() => handleReject(r)} disabled={acting === r.id} style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
═══════════════════════════════════════════════════════════════ */
export default function Leave() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>Leave</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {isAdmin ? 'Review and approve staff leave requests' : 'Request time off and track approval status'}
        </p>
      </div>
      {isAdmin ? <AdminLeave /> : <MyLeave />}
    </div>
  );
}
