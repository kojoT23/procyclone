import React, { useState, useEffect, useCallback } from 'react';
import { schedulerAPI, ridersAPI, ordersAPI, usersAPI, cashAPI, settlementsAPI, restockAPI } from '../utils/api';

const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);

// Numeric/tabular values (amounts, order numbers, times) use a monospace
// face — the same reason a departure board or dispatch ledger does: digits
// line up and scan faster than in a proportional face. Falls back cleanly
// to system monospace if the web font isn't loaded on the page yet.
const mono = { fontFamily: `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace` };

// Formalized signal colors — these were already in use ad hoc (amber for
// "waiting", rust for "stopped"); routed through the same CSS variables
// Orders.js/MassOrder.js already use (var(--accent), var(--amber), etc.)
// instead of separately hardcoded hex, so Scheduler's greens/reds are
// identical to the rest of the app, not just visually close.
const SIGNAL = {
  moving: 'var(--accent)',   // in progress / done
  waiting: 'var(--amber)',   // pending / busy
  stopped: 'var(--red)',     // cancelled / unassign
  idle: 'var(--text-2)',     // neutral / no data
};

const STATUS = {
  pending:     { label: 'Pending',     color: SIGNAL.waiting, badgeClass: 'badge-amber' },
  in_progress: { label: 'In Progress', color: 'var(--blue)',  badgeClass: 'badge-blue' },
  completed:   { label: 'Completed',   color: SIGNAL.moving,  badgeClass: 'badge-green' },
  cancelled:   { label: 'Cancelled',   color: SIGNAL.idle,    badgeClass: 'badge-gray' },
};

const ROLE_LABELS = {
  rider: 'Riders',
  dispatcher: 'Dispatchers',
  warehouse: 'Warehouse',
  cashier: 'Cashiers',
  manager: 'Managers',
  admin: 'Admins',
  super_admin: 'Super Admins',
};
// Delivery-relevant roles first, org-chart roles after.
const ROLE_ORDER = ['rider', 'dispatcher', 'warehouse', 'cashier', 'manager', 'admin', 'super_admin'];

// Common freeform tasks per role — grounded in what each role actually does
// elsewhere in the app (Cash, Inventory, Import Shipments, Settlements),
// not generic placeholders. Shown as quick-pick suggestions in "Other Task"
// so scheduling doesn't require typing the same task titles from scratch
// every time. Roles with nothing operational to suggest (admin/super_admin)
// are left out — those users get the plain free-text field instead.
const TASK_SUGGESTIONS = {
  rider: ['Pick up cash from branch', 'Return undeliverable item', 'Vehicle / fuel check'],
  dispatcher: ['Check in with riders on active routes', 'Reassign stuck or delayed orders', 'Review delivery zone coverage', 'Follow up on rejected deliveries'],
  warehouse: ['Physical stock count', 'Receive incoming shipment', 'Restock low-inventory items', 'Organize storage area'],
  cashier: ['Reconcile daily cash log', 'Bank deposit run', 'Verify pending MoMo payments', 'Print daily cash report'],
  manager: ['Review daily sales / expense report', 'Approve pending rider settlements', 'Staff check-in', 'Supplier call'],
};

const AddTaskModal = ({ staff, defaultStaffId, date, existingZones, onClose, onCreated }) => {
  const [staffId, setStaffId] = useState(defaultStaffId || staff[0]?.id || '');
  // The zone-match comparison only makes sense against the day already
  // loaded for defaultStaffId — if someone switches to a different staff
  // member inside this modal, existingZones would be stale for them, so
  // it's simply not shown rather than showing something misleading.
  const zonesToCompare = String(staffId) === String(defaultStaffId) ? (existingZones || []) : [];
  const selectedRole = staff.find(s => String(s.id) === String(staffId))?.role;
  const suggestions = TASK_SUGGESTIONS[selectedRole] || [];
  const [livePending, setLivePending] = useState([]); // real backlog items, not static labels
  const [loadingLive, setLoadingLive] = useState(false);

  // Pulls real outstanding work for whichever role is selected, instead of
  // just a generic label — e.g. an actual pending cash log with its real
  // amount, not just "Reconcile cash". Only wired up for roles where the
  // response shape is confirmed elsewhere in the app (cash logs, orders);
  // other roles fall back to the static suggestions above.
  useEffect(() => {
    let cancelled = false;
    setLivePending([]);
    if (!selectedRole) return;

    const load = async () => {
      setLoadingLive(true);
      try {
        if (selectedRole === 'cashier') {
          const res = await cashAPI.getAll({ status: 'pending', limit: 20 });
          const logs = res.data.logs || [];
          if (!cancelled) {
            setLivePending(logs.map(l => ({
              label: `Reconcile pending cash log #${l.id} — GHS ${parseFloat(l.amount || 0).toFixed(2)}`,
            })));
          }
        } else if (selectedRole === 'dispatcher') {
          const res = await ordersAPI.getAll({ status: 'failed', limit: 20 });
          const failedOrders = res.data.orders || [];
          if (!cancelled) {
            setLivePending(failedOrders.map(o => ({
              label: `Follow up on failed order ${o.order_number} — ${o.customer_name || 'customer'}`,
            })));
          }
        } else if (selectedRole === 'manager') {
          const res = await settlementsAPI.getAll({ status: 'declared', limit: 20 });
          const declared = res.data.settlements || [];
          if (!cancelled) {
            setLivePending(declared.map(s => ({
              label: `Approve settlement from ${s.rider_name || 'rider'} — GHS ${parseFloat(s.declared_amount || 0).toFixed(2)} (${s.order_count} order${s.order_count !== 1 ? 's' : ''})`,
            })));
          }
        } else if (selectedRole === 'warehouse') {
          const res = await restockAPI.getAll({ status: 'pending', limit: 20 });
          const requests = res.data.restock_requests || [];
          if (!cancelled) {
            setLivePending(requests.map(r => ({
              label: `Restock ${r.product_name}${r.quantity_needed ? ` — ${r.quantity_needed} needed` : ''} (currently ${r.current_stock} in stock)`,
            })));
          }
        }
      } catch (err) {
        console.error('Could not load live pending tasks:', err);
      } finally {
        if (!cancelled) setLoadingLive(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedRole]);
  const [type, setType] = useState('order');
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partialErrors, setPartialErrors] = useState([]);

  useEffect(() => {
    ordersAPI.getAll({ limit: 200 }).then(res => {
      // Already-assigned orders are shown too now — the backend properly
      // supports reassigning them (with a safety check blocking it once
      // picked up). Only truly finished orders are excluded.
      setOrders((res.data.orders || []).filter(o => !['delivered', 'failed', 'returned', 'cancelled'].includes(o.status)));
    }).catch(console.error);
  }, []);

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return o.order_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
  });

  const toggleOrder = (id) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const [pasteValue, setPasteValue] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');

  const handlePasteOrderNumber = (e) => {
    if (e.key && e.key !== 'Enter') return;
    if (e.key === 'Enter') e.preventDefault();
    const q = pasteValue.trim().toLowerCase();
    if (!q) return;

    const exact = orders.find(o => o.order_number?.toLowerCase() === q);
    if (exact) {
      setSelectedOrderIds(prev => prev.includes(exact.id) ? prev : [...prev, exact.id]);
      setPasteValue('');
      setPasteMsg(`✓ ${exact.order_number} added`);
      setTimeout(() => setPasteMsg(''), 2000);
      return;
    }

    const matches = orders.filter(o => o.order_number?.toLowerCase().includes(q));
    if (matches.length > 0) {
      setSearch(pasteValue.trim());
      setPasteMsg(`${matches.length} order(s) match — pick from the list below`);
    } else {
      setPasteMsg(`No order found matching "${pasteValue.trim()}"`);
    }
  };

  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredOrders.map(o => o.id);
    setSelectedOrderIds(prev => allVisibleSelected
      ? prev.filter(id => !visibleIds.includes(id))
      : [...new Set([...prev, ...visibleIds])]);
  };

  const handleSubmit = async () => {
    setError('');
    setPartialErrors([]);
    if (!staffId) return setError('Select a staff member');
    if (type === 'order' && selectedOrderIds.length === 0) return setError('Select at least one order');
    if (type === 'freeform' && !title.trim()) return setError('Enter a task title');

    setSubmitting(true);
    try {
      if (type === 'freeform') {
        await schedulerAPI.create({
          assigned_to: staffId,
          task_date: date,
          type: 'freeform',
          title: title.trim(),
          notes: notes.trim() || undefined,
        });
        onCreated();
        onClose();
        return;
      }

      // Multiple orders — fire independently so one payment-not-verified
      // order (or a non-rider recipient) doesn't block the rest of the batch.
      const results = await Promise.allSettled(
        selectedOrderIds.map(orderId =>
          schedulerAPI.create({
            assigned_to: staffId,
            task_date: date,
            type: 'order',
            order_id: orderId,
            notes: notes.trim() || undefined,
          })
        )
      );

      const failures = results
        .map((r, i) => ({ r, orderId: selectedOrderIds[i] }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ r, orderId }) => {
          const order = orders.find(o => o.id === orderId);
          const msg = r.reason?.response?.data?.message || 'Could not schedule';
          return `${order?.order_number || `Order #${orderId}`}: ${msg}`;
        });

      const succeededCount = results.length - failures.length;

      if (failures.length === 0) {
        onCreated();
        onClose();
      } else if (succeededCount > 0) {
        setPartialErrors(failures);
        setSelectedOrderIds(prev => prev.filter(id => {
          const order = orders.find(o => o.id === id);
          return failures.some(f => f.startsWith(order?.order_number || `Order #${id}`));
        }));
        onCreated();
      } else {
        setPartialErrors(failures);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create task');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !staffId ||
    (type === 'order' && selectedOrderIds.length === 0) ||
    (type === 'freeform' && !title.trim());

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, padding: 24, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Add Task</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-2)' }}>✕</button>
        </div>
        <p style={{ margin: '2px 0 16px', fontSize: 13, color: 'var(--text-2)' }}>For {date}</p>

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Staff Member *</label>
        <select className="form-input" value={staffId} onChange={e => setStaffId(parseInt(e.target.value))} style={{ marginBottom: 14 }}>
          {ROLE_ORDER.map(role => {
            const members = staff.filter(s => s.role === role);
            if (members.length === 0) return null;
            return (
              <optgroup key={role} label={ROLE_LABELS[role]}>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            );
          })}
        </select>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ v: 'order', l: 'Deliver Orders' }, { v: 'freeform', l: 'Other Task' }].map(opt => (
            <button key={opt.v} className={`btn btn-sm ${type === opt.v ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setType(opt.v)}>
              {opt.l}
            </button>
          ))}
        </div>

        {type === 'order' ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              Paste or type an order number
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                className="form-input"
                value={pasteValue}
                onChange={e => setPasteValue(e.target.value)}
                onKeyDown={handlePasteOrderNumber}
                placeholder="e.g. SW-10234, then press Enter"
                style={{ flex: 1 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={handlePasteOrderNumber}>Add</button>
            </div>
            {pasteMsg && <p style={{ fontSize: 12, color: pasteMsg.startsWith('✓') ? 'var(--accent-dim)' : '#d97706', margin: '0 0 10px' }}>{pasteMsg}</p>}

            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              Or browse orders
            </label>
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by order number or customer…"
              style={{ marginBottom: 8 }}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, maxHeight: 320, overflowY: 'auto' }}>
              {filteredOrders.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  {orders.length === 0 ? 'No unassigned orders available.' : 'No orders match your search.'}
                </div>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-2)', cursor: 'pointer', background: '#f9fafb' }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Select all shown ({filteredOrders.length})</span>
                  </label>
                  {filteredOrders.map(o => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    const zoneMatches = o.zone_name && zonesToCompare.includes(o.zone_name);
                    return (
                      <label
                        key={o.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-2)', cursor: 'pointer',
                          background: isSelected ? 'var(--accent-bg)' : 'transparent',
                        }}
                      >
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOrder(o.id)} />
                        <span style={{ fontSize: 13, flex: 1, fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--accent-dim)' : 'var(--text)' }}>
                          {o.order_number} — {o.customer_name} ({fmt(o.total_amount)})
                          {o.zone_name && (
                            <span style={{ ...mono, fontSize: 11, color: zoneMatches ? 'var(--accent-dim)' : 'var(--text-3)', marginLeft: 6 }}>
                              {zoneMatches ? `✓ ${o.zone_name} — matches this day's route` : `· ${o.zone_name}`}
                            </span>
                          )}
                          {o.rider_name && (
                            <span style={{ color: '#d97706', fontWeight: 600 }}> · currently with {o.rider_name}</span>
                          )}
                        </span>
                        {isSelected && <span style={{ color: 'var(--accent-dim)', fontSize: 14 }}>✓</span>}
                      </label>
                    );
                  })}
                </>
              )}
            </div>
            {selectedOrderIds.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--accent-dim)', fontWeight: 600, margin: '0 0 12px' }}>{selectedOrderIds.length} order(s) selected</p>
            )}
          </>
        ) : (
          <>
            {(suggestions.length > 0 || livePending.length > 0) && (
              <select
                className="form-input"
                value=""
                onChange={e => { if (e.target.value) setTitle(e.target.value); }}
                style={{ marginBottom: 8 }}
              >
                <option value="">
                  {loadingLive ? 'Checking pending work…' : 'Choose a task for this role…'}
                </option>
                {livePending.length > 0 && (
                  <optgroup label="📌 Pending right now">
                    {livePending.map((p, i) => <option key={`live-${i}`} value={p.label}>{p.label}</option>)}
                  </optgroup>
                )}
                {suggestions.length > 0 && (
                  <optgroup label="Common tasks">
                    {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                )}
              </select>
            )}
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pick up cash from branch X" style={{ marginBottom: 12 }} />
          </>
        )}

        <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional, applied to all selected)" style={{ minHeight: 70, resize: 'vertical' }} />

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</div>}
        {partialErrors.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginTop: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: '#dc2626' }}>Some orders couldn't be scheduled:</p>
            {partialErrors.map((msg, i) => (
              <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#991b1b' }}>{msg}</p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            {partialErrors.length > 0 ? 'Done' : 'Cancel'}
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, opacity: submitDisabled ? 0.5 : 1, cursor: submitDisabled ? 'not-allowed' : 'pointer' }}
            onClick={handleSubmit}
            disabled={submitDisabled}
          >
            {submitting ? 'Adding…' : type === 'order' && selectedOrderIds.length > 1 ? `Add ${selectedOrderIds.length} Orders` : 'Add to Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskRow = ({ task, riders, onUpdateStatus, onDelete, onReassign, isLast }) => {
  const st = STATUS[task.status] || STATUS.pending;
  const [reassigning, setReassigning] = useState(false);
  const otherRiders = riders.filter(r => r.id !== task.assigned_to);
  const isOpenOrderTask = task.type === 'order' && !['completed', 'cancelled'].includes(task.status);
  const nodeColor = st.color;
  const nodeFilled = ['completed', 'in_progress'].includes(task.status);

  return (
    <div style={{ display: 'flex' }}>
      {/* Route rail: one node per stop, connected by a line — this rider's
          day really is a sequence (sort_order), so the layout says so. */}
      <div style={{ width: 26, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 19 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: nodeFilled ? nodeColor : '#fff',
          border: `2px solid ${nodeColor}`,
        }} />
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, background: 'var(--border)', marginTop: 2 }} />}
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 14px 2px', borderBottom: isLast ? 'none' : '1px solid var(--border-2)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{task.title}</span>
            <span className={`badge ${st.badgeClass}`} style={{ fontSize: 10 }}>{st.label}</span>
          </div>
          {task.type === 'order' && (
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
              {task.customer_name} · {task.delivery_address}
              {task.zone_name && <span style={{ ...mono, fontSize: 11, color: 'var(--blue)', marginLeft: 6 }}>· {task.zone_name}</span>}
            </p>
          )}
          {task.notes && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>{task.notes}</p>}
          {task.assigned_by_name && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#cbd5e1' }}>Scheduled by {task.assigned_by_name}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {task.type === 'order' && task.total_amount && (
            <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>{fmt(task.total_amount)}</span>
          )}
          {task.type === 'freeform' && !['completed', 'cancelled'].includes(task.status) && (
            <>
              {task.status === 'pending' && (
                <button className="btn btn-secondary btn-sm" onClick={() => onUpdateStatus(task, 'in_progress')}>Start</button>
              )}
              <button className="btn btn-success btn-sm" onClick={() => onUpdateStatus(task, 'completed')}>Complete</button>
            </>
          )}
          {task.type === 'order' && !['completed', 'cancelled'].includes(task.status) && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic', marginRight: 8 }}>Updates once delivered</span>
          )}
          {isOpenOrderTask && (
            reassigning ? (
              <select
                className="form-input"
                style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                autoFocus
                defaultValue=""
                onChange={e => {
                  const newRiderId = parseInt(e.target.value);
                  setReassigning(false);
                  if (newRiderId) onReassign(task, newRiderId);
                }}
                onBlur={() => setReassigning(false)}
              >
                <option value="" disabled>Reassign to…</option>
                {otherRiders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : (
              <button
                onClick={() => setReassigning(true)}
                className="btn btn-blue btn-sm"
                title="Move this delivery to a different rider without unassigning first"
              >
                ⇄ Reassign
              </button>
            )
          )}
          <button
            onClick={() => onDelete(task)}
            className="btn btn-danger btn-sm"
            title={task.type === 'order' ? 'Removes the delivery, frees the rider, and puts this order back to unassigned' : 'Removes this task from the schedule'}
          >
            {task.type === 'order' ? '⊘ Unassign' : '✕ Remove'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Scheduler = () => {
  const [staff, setStaff] = useState([]);
  const [riderAvailability, setRiderAvailability] = useState({}); // keyed by users.id
  const [expandedRole, setExpandedRole] = useState('rider');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [dayTaskCounts, setDayTaskCounts] = useState({}); // { [userId]: openTaskCount }

  // Day-wide counts, independent of which staff member is currently
  // selected — this is what lets the sidebar show "how loaded is this
  // person already" before you assign them more, instead of only finding
  // out after opening their individual schedule. Re-fetched after any
  // change (assign/reassign/delete/status update), not just on date
  // change, or the badge would silently go stale right after the action
  // that was supposed to update it.
  const fetchDayCounts = useCallback(() => {
    schedulerAPI.getDay({ date }).then(res => {
      const counts = {};
      (res.data.tasks || []).forEach(t => {
        if (['pending', 'in_progress'].includes(t.status)) {
          counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
        }
      });
      setDayTaskCounts(counts);
    }).catch(err => {
      // Non-privileged roles get a 403 here (getDaySchedule is
      // privileged-only) — that's expected for anyone below manager,
      // not an error worth surfacing; the badges just won't show.
      if (err.response?.status !== 403) console.error(err);
    });
  }, [date]);

  useEffect(() => { fetchDayCounts(); }, [fetchDayCounts]);

  useEffect(() => {
    Promise.all([
      usersAPI.getAll({ limit: 500 }),
      ridersAPI.getAll({ limit: 500 }),
    ]).then(([usersRes, ridersRes]) => {
      const staffList = usersRes.data.users || usersRes.data.staff || [];
      setStaff(staffList);

      const availability = {};
      (ridersRes.data.riders || []).forEach(r => {
        if (r.user_id) availability[r.user_id] = r.is_available;
      });
      setRiderAvailability(availability);

      const firstRider = staffList.find(s => s.role === 'rider');
      setSelectedStaff(firstRider || staffList[0] || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!selectedStaff) return;
    setLoadingTasks(true);
    try {
      const res = await schedulerAPI.getSchedule({ user_id: selectedStaff.id, date });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedStaff, date]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleUpdateStatus = async (task, status) => {
    try {
      await schedulerAPI.updateStatus(task.id, { status });
      fetchSchedule();
      fetchDayCounts();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update task');
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Remove "${task.title}" from the schedule?`)) return;
    try {
      await schedulerAPI.delete(task.id);
      fetchSchedule();
      fetchDayCounts();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove task');
    }
  };

  // Reuses createTask's existing reassignment logic (it already detects an
  // order that's mid-delivery and moves the real delivery + rider state
  // over correctly) instead of a separate unassign-then-reassign flow.
  const handleReassign = async (task, newRiderId) => {
    try {
      await schedulerAPI.create({
        assigned_to: newRiderId,
        task_date: date,
        type: 'order',
        order_id: task.order_id,
      });
      fetchSchedule();
      fetchDayCounts();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not reassign this delivery');
    }
  };

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading staff…</span></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Scheduler</h1>
        <p style={{ color: 'var(--text-2)', margin: '4px 0 0', fontSize: 14 }}>Assign orders and tasks to any staff member for any day — works even while a rider shows busy.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }} className="scheduler-grid">
        {/* Staff categories */}
        <div className="card" style={{ padding: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 12px 4px', margin: 0 }}>Staff</p>
          {ROLE_ORDER.map(role => {
            const members = staff.filter(s => s.role === role);
            if (members.length === 0) return null;
            const isOpen = expandedRole === role;
            return (
              <div key={role}>
                <button
                  onClick={() => setExpandedRole(isOpen ? null : role)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ROLE_LABELS[role]}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{members.length} {isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div style={{ paddingLeft: 6, marginBottom: 4 }}>
                    {members.map(m => {
                      const busy = role === 'rider' ? riderAvailability[m.id] === false : null;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedStaff(m)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: selectedStaff?.id === m.id ? 'var(--accent-bg)' : 'transparent',
                            borderLeft: selectedStaff?.id === m.id ? '3px solid var(--accent)' : '3px solid transparent',
                            marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {busy !== null && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: busy ? SIGNAL.waiting : SIGNAL.moving, flexShrink: 0 }} title={busy ? 'Busy' : 'Available'} />
                            )}
                            {m.name}
                          </div>
                          {dayTaskCounts[m.id] > 0 && (
                            <span
                              style={{ ...mono, fontSize: 11, fontWeight: 700, color: 'var(--text-2)', background: 'var(--border-2)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}
                              title={`${dayTaskCounts[m.id]} open task${dayTaskCounts[m.id] !== 1 ? 's' : ''} today`}
                            >
                              {dayTaskCounts[m.id]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected staff member's schedule */}
        <div>
          {selectedStaff && (() => {
            const orderTasks = tasks.filter(t => t.type === 'order' && t.status !== 'cancelled');
            const doneCount = orderTasks.filter(t => t.status === 'completed').length;
            const totalCount = orderTasks.length;
            const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
            // Distinct zones covered today, in order of first appearance —
            // a rider bouncing between 4+ different zones in one day is a
            // routing inefficiency worth seeing before it's too late to
            // reassign a stop to someone closer.
            const zonesToday = [...new Set(orderTasks.map(t => t.zone_name).filter(Boolean))];
            return (
            <>
              <div className="card" style={{ marginBottom: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedStaff.name}</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}><span style={mono}>{tasks.length}</span> task{tasks.length !== 1 ? 's' : ''} on <span style={mono}>{date}</span></p>
                  {totalCount > 0 && (
                    <div style={{ marginTop: 8, maxWidth: 220 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: SIGNAL.moving }}>{doneCount} of {totalCount} delivered</span>
                        <span style={{ ...mono, fontSize: 11, color: 'var(--text-3)' }}>{totalCount - doneCount} left</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--border-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: SIGNAL.moving, borderRadius: 3, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )}
                  {zonesToday.length > 0 && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: zonesToday.length >= 4 ? SIGNAL.waiting : 'var(--text-2)' }}>
                      {zonesToday.length >= 4 ? '⚠ Scattered across ' : 'Covers '}
                      <strong>{zonesToday.length} zone{zonesToday.length !== 1 ? 's' : ''}</strong>: {zonesToday.join(', ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)}>+ Add Task</button>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loadingTasks ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
                ) : tasks.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)' }}>Nothing scheduled for this person on this day.</div>
                ) : (
                  tasks.map((task, i) => (
                    <TaskRow key={task.id} task={task} riders={staff.filter(s => s.role === 'rider')} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} onReassign={handleReassign} isLast={i === tasks.length - 1} />
                  ))
                )}
              </div>
            </>
            );
          })()}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @media (max-width: 900px) {
          .scheduler-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {showAddTask && selectedStaff && (
        <AddTaskModal
          staff={staff}
          defaultStaffId={selectedStaff.id}
          date={date}
          existingZones={[...new Set(tasks.filter(t => t.type === 'order' && t.status !== 'cancelled').map(t => t.zone_name).filter(Boolean))]}
          onClose={() => setShowAddTask(false)}
          onCreated={() => { fetchSchedule(); fetchDayCounts(); }}
        />
      )}
    </div>
  );
};

export default Scheduler;
