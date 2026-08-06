import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTimeRange = (start, end) => `${start?.slice(0, 5)} – ${end?.slice(0, 5)}`;

const todayISO = () => new Date().toISOString().split('T')[0];
const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const groupByDate = (shifts) => {
  const groups = {};
  shifts.forEach(s => {
    if (!groups[s.shift_date]) groups[s.shift_date] = [];
    groups[s.shift_date].push(s);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
};

/* ═══════════════════════════════════════════════════════════════
   Read-only view for regular staff/riders
═══════════════════════════════════════════════════════════════ */
function MySchedule() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrAPI.getMyShifts({ from: todayISO(), to: addDaysISO(30) });
      setShifts(res.data.shifts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  if (shifts.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
        <p style={{ color: '#6b7280' }}>No upcoming shifts scheduled yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groupByDate(shifts).map(([date, dayShifts]) => (
        <div key={date}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {fmtDate(date)}
          </div>
          {dayShifts.map(s => (
            <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18' }}>{fmtTimeRange(s.start_time, s.end_time)}</div>
                {s.role_label && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.role_label}</div>}
                {s.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{s.notes}</div>}
              </div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37, #b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📅</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Full scheduler for admins/managers
═══════════════════════════════════════════════════════════════ */
function AdminScheduler() {
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: '', shift_date: todayISO(), start_time: '08:00', end_time: '17:00', role_label: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsRes, staffRes] = await Promise.all([
        hrAPI.getAllShifts({ from: addDaysISO(-7), to: addDaysISO(30), limit: 200 }),
        usersAPI.getAll({ limit: 200 }),
      ]);
      setShifts(shiftsRes.data.shifts || []);
      setStaff(staffRes.data.users || staffRes.data.staff || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ user_id: '', shift_date: todayISO(), start_time: '08:00', end_time: '17:00', role_label: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (shift) => {
    setEditing(shift);
    setForm({
      user_id: shift.user_id, shift_date: shift.shift_date,
      start_time: shift.start_time?.slice(0, 5), end_time: shift.end_time?.slice(0, 5),
      role_label: shift.role_label || '', notes: shift.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.user_id || !form.shift_date || !form.start_time || !form.end_time) {
      return alert('Staff member, date, start and end time are required');
    }
    if (form.start_time >= form.end_time) {
      return alert('Start time must be before end time');
    }
    try {
      setSaving(true);
      editing
        ? await hrAPI.updateShift(editing.id, form)
        : await hrAPI.createShift(form);
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving shift');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shift) => {
    if (!window.confirm(`Delete this shift for ${shift.user_name}?`)) return;
    try {
      await hrAPI.deleteShift(shift.id);
      fetchData();
    } catch {
      alert('Error deleting shift');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Assign Shift
        </button>
      </div>

      {shifts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ color: '#6b7280' }}>No shifts scheduled yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groupByDate(shifts).map(([date, dayShifts]) => (
            <div key={date}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {fmtDate(date)}
              </div>
              {dayShifts.map(s => (
                <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{s.user_name} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12, textTransform: 'capitalize' }}>({s.user_role?.replace('_', ' ')})</span></div>
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{fmtTimeRange(s.start_time, s.end_time)}{s.role_label ? ` · ${s.role_label}` : ''}</div>
                    {s.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{s.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(s)} style={{ background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(s)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>{editing ? 'Edit Shift' : 'Assign Shift'}</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Staff Member *</label>
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} disabled={!!editing}>
              <option value="">Select staff member…</option>
              {staff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace('_', ' ')})</option>)}
            </select>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Date *</label>
            <input type="date" value={form.shift_date} onChange={e => setForm(f => ({ ...f, shift_date: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Start *</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>End *</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Role / Position Label</label>
            <input value={form.role_label} onChange={e => setForm(f => ({ ...f, role_label: e.target.value }))} placeholder="e.g. Warehouse AM, Dispatch PM" style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', marginBottom: 16, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Assign Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Entry point — routes to the right view based on role
═══════════════════════════════════════════════════════════════ */
export default function Scheduler() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>{isAdmin ? 'Scheduler' : 'My Schedule'}</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {isAdmin ? 'Assign and manage shifts for staff and riders' : 'Your upcoming shifts'}
        </p>
      </div>
      {isAdmin ? <AdminScheduler /> : <MySchedule />}
    </div>
  );
}
