import React, { useState, useEffect, useCallback } from 'react';
import { schedulerAPI, ridersAPI, ordersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// customer_support included deliberately — same reasoning as
// schedulerController.js on the backend: Transport Portal staff need the
// full Scheduler (any rider's schedule, Add Task, reassign), not the
// single-person "My Schedule" view. Without this, Transport agents were
// silently getting the limited view despite the backend already granting
// them full access.
const PRIVILEGED_ROLES = ['super_admin', 'admin', 'manager', 'customer_support'];
const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);

const card = { background: '#fff', borderRadius: 14, marginBottom: 10, padding: '13px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };

// Same tokens as the Dashboard Scheduler — numeric values (amounts, counts)
// get a monospace face so digits line up and scan quickly, and the three
// signal colors are named once instead of re-picked per screen.
const mono = { fontFamily: `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace` };
const SIGNAL = {
  moving: '#22c55e',
  waiting: '#f59e0b',
  stopped: '#ef4444',
  idle: '#9ca3af',
};

const STATUS = {
  pending:     { label: 'Pending',     color: SIGNAL.waiting, bg: '#fffbeb' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: SIGNAL.moving, bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   color: SIGNAL.idle, bg: '#f3f4f6' },
};

const AddTaskModal = ({ riderId, date, onClose, onCreated }) => {
  const [type, setType] = useState('order');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only orders with no delivery yet — matches the whole point of this
    // tool: giving a busy rider MORE work, not re-organizing what's
    // already assigned.
    ordersAPI.getAll({ limit: 100 }).then(res => {
      // Already-assigned orders are shown too now — the backend properly
      // supports reassigning them (with a safety check blocking it once
      // picked up). Only truly finished orders are excluded.
      setOrders((res.data.orders || []).filter(o => !['delivered', 'failed', 'returned', 'cancelled'].includes(o.status)));
    }).catch(console.error).finally(() => setLoadingOrders(false));
  }, []);

  const toggleOrder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => setSelectedIds(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  const handleSubmit = async () => {
    setError('');
    if (type === 'order' && selectedIds.size === 0) return setError('Select at least one order');
    if (type === 'freeform' && !title.trim()) return setError('Enter a task title');
    setSubmitting(true);

    if (type === 'freeform') {
      try {
        await schedulerAPI.create({ assigned_to: riderId, task_date: date, type: 'freeform', title: title.trim(), notes: notes.trim() || undefined });
        onCreated();
      } catch (err) {
        setError(err.response?.data?.message || 'Could not create task');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Multiple orders, submitted individually — some may fail the MoMo
    // gate while others succeed, so report per-order rather than
    // treating it as all-or-nothing.
    const idsArr = [...selectedIds];
    const results = await Promise.allSettled(
      idsArr.map(id => schedulerAPI.create({ assigned_to: riderId, task_date: date, type: 'order', order_id: id, notes: notes.trim() || undefined }))
    );
    const failures = results.map((r, i) => ({ r, order: orders.find(o => o.id === idsArr[i]) })).filter(x => x.r.status === 'rejected');

    setSubmitting(false);
    if (failures.length === 0) {
      onCreated();
    } else if (failures.length === idsArr.length) {
      setError(`None could be added: ${failures.map(f => f.order?.order_number).join(', ')} — check MoMo payment verification`);
    } else {
      setError(`${idsArr.length - failures.length} added. Failed: ${failures.map(f => f.order?.order_number).join(', ')}`);
      onCreated();
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 28px' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a18', marginBottom: 16 }}>Add Task</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ v: 'order', l: 'Deliver an Order' }, { v: 'freeform', l: 'Other Task' }].map(opt => (
            <button key={opt.v} onClick={() => setType(opt.v)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: type === opt.v ? '1px solid #22c55e' : '1px solid #e5e7eb',
                background: type === opt.v ? '#f0fdf4' : '#fff',
                color: type === opt.v ? '#16a34a' : '#6b7280',
              }}>
              {opt.l}
            </button>
          ))}
        </div>

        {type === 'order' ? (
          <div style={{ marginBottom: 12 }}>
            {loadingOrders ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading orders…</div>
            ) : orders.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#f9f9f8', borderRadius: 10 }}>
                No unassigned orders right now.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <button onClick={toggleAll} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#6b7280', cursor: 'pointer' }}>
                    {selectedIds.size === orders.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{selectedIds.size} selected</span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  {orders.map(o => (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleOrder(o.id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>{o.order_number} — {o.customer_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{o.delivery_address}</div>
                        {o.rider_name && <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Currently with {o.rider_name}</div>}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a18' }}>{fmt(o.total_amount)}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pick up cash from branch X"
            style={{ ...input, marginBottom: 12 }} />
        )}

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
          style={{ ...input, minHeight: 70, resize: 'vertical' }} />

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Adding…' : type === 'order' && selectedIds.size > 0 ? `Add ${selectedIds.size} Order${selectedIds.size !== 1 ? 's' : ''}` : 'Add to Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskCard = ({ task, isPrivileged, isSelf, onUpdateStatus, onDelete, riders, onReassign, isLast }) => {
  const st = STATUS[task.status] || STATUS.pending;
  const [reassigning, setReassigning] = useState(false);
  const canReassign = isPrivileged && task.type === 'order' && !['completed', 'cancelled'].includes(task.status) && riders?.length > 0;
  const nodeFilled = ['completed', 'in_progress'].includes(task.status);

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {/* Rail: a node per stop, connected down to the next one — mirrors
          the Dashboard Scheduler's rail so the "this is a route" idea
          reads the same on mobile as it does on desktop. */}
      <div style={{ width: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: nodeFilled ? st.color : '#fff', border: `2px solid ${st.color}` }} />
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 14, background: '#e5e7eb', marginTop: 2 }} />}
      </div>

      <div style={{ ...card, flex: 1, borderLeft: `4px solid ${st.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{task.title}</div>
            {task.type === 'order' && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {task.customer_name} · {task.delivery_address}
              </div>
            )}
            {task.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{task.notes}</div>}
            {isPrivileged && task.assigned_by_name && (
              <div style={{ fontSize: 11, color: '#c1c7d0', marginTop: 4 }}>Scheduled by {task.assigned_by_name}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
            {task.type === 'order' && task.total_amount && (
              <div style={{ ...mono, fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{fmt(task.total_amount)}</div>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, marginTop: 4, display: 'inline-block' }}>
              {st.label}
            </span>
          </div>
        </div>

        {/* Order tasks are a reflection of the real delivery, not manually
            completed here — that would skip proof-of-delivery entirely and
            leave the actual order stuck. Only freeform tasks (no real
            delivery behind them) get manual status control. */}
        {task.type === 'freeform' && (isSelf || isPrivileged) && !['completed', 'cancelled'].includes(task.status) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {task.status === 'pending' && (
              <button onClick={() => onUpdateStatus(task, 'in_progress')}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#eff6ff', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ▶ Start
              </button>
            )}
            <button onClick={() => onUpdateStatus(task, 'completed')}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✓ Complete
            </button>
            <button onClick={() => onUpdateStatus(task, 'cancelled')}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#f3f4f6', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Can't do this
            </button>
          </div>
        )}
        {task.type === 'order' && isSelf && !['completed', 'cancelled'].includes(task.status) && (
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#9ca3af', fontStyle: 'italic' }}>
            Complete this from Deliveries — it'll update here automatically.
          </p>
        )}
        {canReassign && (
          reassigning ? (
            <select
              autoFocus
              defaultValue=""
              onChange={e => { const id = parseInt(e.target.value); setReassigning(false); if (id) onReassign(task, id); }}
              onBlur={() => setReassigning(false)}
              style={{ ...input, marginTop: 8, padding: '7px 10px', fontSize: 12 }}
            >
              <option value="" disabled>Reassign to…</option>
              {riders.filter(r => String(r.user_id) !== String(task.assigned_to)).map(r => (
                <option key={r.id} value={r.user_id}>{r.name}</option>
              ))}
            </select>
          ) : (
            <button onClick={() => setReassigning(true)}
              style={{ marginTop: 8, background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, marginRight: 14 }}>
              ⇄ Reassign
            </button>
          )
        )}
        {isPrivileged && (
          <button onClick={() => onDelete(task)}
            style={{ marginTop: 8, background: 'none', border: 'none', color: SIGNAL.stopped, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Remove from schedule
          </button>
        )}
      </div>
    </div>
  );
};

const PortalSchedule = () => {
  const { user } = useAuth();
  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role);

  const [date, setDate] = useState(todayStr());
  const [riders, setRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    if (!isPrivileged) return;
    // Using r.user_id, NOT r.id — scheduled_tasks.assigned_to is a foreign
    // key to users(id), while r.id is the riders table's own separate
    // primary key. Riders with no linked login (user_id is nullable) are
    // filtered out entirely since there's no user account to attach a
    // task to.
    ridersAPI.getAll().then(res => {
      const list = (res.data.riders || []).filter(r => r.user_id);
      setRiders(list);
      if (list.length > 0) setSelectedRider(String(list[0].user_id));
    }).catch(console.error);
  }, [isPrivileged]);

  const fetchSchedule = useCallback(async () => {
    if (isPrivileged && !selectedRider) return;
    setLoading(true);
    try {
      const params = { date };
      if (isPrivileged) params.user_id = selectedRider;
      const res = await schedulerAPI.getSchedule(params);
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [date, selectedRider, isPrivileged]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleUpdateStatus = async (task, status) => {
    try {
      await schedulerAPI.updateStatus(task.id, { status });
      fetchSchedule();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update task');
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Remove "${task.title}" from the schedule?`)) return;
    try {
      await schedulerAPI.delete(task.id);
      fetchSchedule();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove task');
    }
  };

  // Reuses createTask's existing reassignment logic on the backend — moves
  // the real delivery to the new rider instead of a separate unassign step.
  const handleReassign = async (task, newRiderUserId) => {
    try {
      await schedulerAPI.create({ assigned_to: newRiderUserId, task_date: date, type: 'order', order_id: task.order_id });
      fetchSchedule();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not reassign this delivery');
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>
        {isPrivileged ? 'Scheduler' : 'My Schedule'}
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {isPrivileged && (
          <select value={selectedRider} onChange={e => setSelectedRider(e.target.value)} style={{ ...input, flex: 1 }}>
            {riders.map(r => <option key={r.id} value={r.user_id}>{r.name}{r.is_available === false ? ' (busy)' : ''}</option>)}
          </select>
        )}
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, flex: isPrivileged ? 'none' : 1, width: isPrivileged ? 150 : undefined }} />
      </div>

      {isPrivileged && (
        <button onClick={() => setShowAddTask(true)}
          style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
          + Add Task
        </button>
      )}

      {(() => {
        const orderTasks = tasks.filter(t => t.type === 'order' && t.status !== 'cancelled');
        const doneCount = orderTasks.filter(t => t.status === 'completed').length;
        const totalCount = orderTasks.length;
        const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
        if (totalCount === 0) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...mono, fontSize: 12.5, fontWeight: 600, color: SIGNAL.moving }}>{doneCount} of {totalCount} delivered</span>
              <span style={{ ...mono, fontSize: 11.5, color: '#9ca3af' }}>{totalCount - doneCount} left</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: SIGNAL.moving, borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#9ca3af' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
          {isPrivileged ? 'Nothing scheduled for this rider on this day.' : 'Nothing on your schedule for this day.'}
        </div>
      ) : (
        <div>
          {tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              isPrivileged={isPrivileged}
              isSelf={!isPrivileged}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDelete}
              riders={riders}
              onReassign={handleReassign}
              isLast={i === tasks.length - 1}
            />
          ))}
        </div>
      )}

      {showAddTask && (
        <AddTaskModal
          riderId={selectedRider}
          date={date}
          onClose={() => setShowAddTask(false)}
          onCreated={() => { setShowAddTask(false); fetchSchedule(); }}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>
    </div>
  );
};

export default PortalSchedule;
