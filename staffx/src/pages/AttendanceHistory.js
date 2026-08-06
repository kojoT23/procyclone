import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDuration = (minutes) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StatusBadge = ({ status }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, textTransform: 'uppercase',
    background: status === 'clocked_in' ? '#dcfce7' : '#f3f4f6',
    color: status === 'clocked_in' ? '#16a34a' : '#6b7280',
  }}>
    {status === 'clocked_in' ? 'Active' : 'Complete'}
  </span>
);

/* ═══════════════════════════════════════════════════════════════
   Staff view — own history
═══════════════════════════════════════════════════════════════ */
function MyHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrAPI.getMyHistory({ limit: 60 })
      .then(res => setRecords(res.data.records || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  if (records.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🕐</div>
        <p style={{ color: '#6b7280' }}>No attendance records yet.</p>
      </div>
    );
  }

  const totalHours = records.reduce((sum, r) => sum + (r.total_minutes || 0), 0);

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-around', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18' }}>{records.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Days Recorded</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18' }}>{fmtDuration(totalHours)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Total Hours</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>{fmtDate(r.work_date)}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{fmtTime(r.clock_in_at)} – {r.clock_out_at ? fmtTime(r.clock_out_at) : 'ongoing'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{fmtDuration(r.total_minutes)}</div>
              <div style={{ marginTop: 2 }}><StatusBadge status={r.status} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Admin view — all staff attendance, filterable by date
═══════════════════════════════════════════════════════════════ */
function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (dateFilter) params.date = dateFilter;
      const res = await hrAPI.getAllAttendance(params);
      setRecords(res?.data?.records || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  return (
    <div>
      <input
        type="date"
        value={dateFilter}
        onChange={e => setDateFilter(e.target.value)}
        style={{ width: '100%', marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕐</div>
          <p style={{ color: '#6b7280' }}>No attendance records{dateFilter ? ' for this date' : ''}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>{r.user_name} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11, textTransform: 'capitalize' }}>({r.user_role?.replace('_', ' ')})</span></div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{fmtDate(r.work_date)} · {fmtTime(r.clock_in_at)} – {r.clock_out_at ? fmtTime(r.clock_out_at) : 'ongoing'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{fmtDuration(r.total_minutes)}</div>
                <div style={{ marginTop: 2 }}><StatusBadge status={r.status} /></div>
              </div>
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
export default function AttendanceHistory() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>Attendance History</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {isAdmin ? 'All staff clock-in/out records' : 'Your past clock-ins and hours worked'}
        </p>
      </div>
      {isAdmin ? <AdminAttendance /> : <MyHistory />}
    </div>
  );
}
