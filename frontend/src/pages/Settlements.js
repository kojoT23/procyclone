import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { settlementsAPI, ridersAPI } from '../utils/api';

/* ═══════════════════════════════════════════════════════════════════
   SETTLEMENTS PAGE
   Two separate visibility rules, matching backend/src/config/roles.js:
   - Financial Overview & rider-cash review queue are visible to anyone
     who can view_reports: super_admin, admin, manager, accountant, auditor.
   - Actually APPROVING a settlement is gated by manage_cash on the
     backend, held by: super_admin, admin, accountant, cashier (note:
     manager does NOT have manage_cash — deliberately excluded here so
     the UI doesn't show a button that the backend will then reject).
   'rider' is a real role in this system — a person's rider status is
   still resolved via the riders table (user_id match) rather than the
   role string, since someone could hold a non-rider role and still
   have a linked rider profile, or vice versa. ═══════════════════════════════════════════════════════════════════ */
const Settlements = () => {
  const { user } = useAuth();
  const canViewFinancials = ['super_admin', 'admin', 'manager', 'accountant', 'auditor'].includes(user?.role);
  const canApproveCash = ['super_admin', 'admin', 'accountant', 'cashier'].includes(user?.role);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settlements</h1>
          <p className="page-subtitle">Track and confirm cash riders have collected and handed over</p>
        </div>
      </div>
      <SettlementsBody
        user={user}
        canViewFinancials={canViewFinancials}
        canApproveCash={canApproveCash}
      />
    </div>
  );
};

/* ─── Resolve identity then render the right view(s) ──────────────
   A person can be BOTH a rider AND office staff in principle (e.g.
   an accountant who also rides sometimes) — so we show the rider card
   if they have a rider profile, independent of their other permissions. ── */
const SettlementsBody = ({ user, canViewFinancials, canApproveCash }) => {
  const [checkingRider, setCheckingRider] = useState(true);
  const [myRider, setMyRider] = useState(null);

  useEffect(() => {
    const checkIfRider = async () => {
      try {
        const res = await ridersAPI.getAll({ limit: 200 });
        const match = (res.data.riders || []).find(r => r.user_id === user?.id);
        setMyRider(match || null);
      } catch (err) {
        console.error('Could not check rider status:', err);
      } finally {
        setCheckingRider(false);
      }
    };
    if (user) checkIfRider();
  }, [user]);

  if (checkingRider) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span className="loading-text">Loading…</span>
      </div>
    );
  }

  if (!myRider && !canViewFinancials && !canApproveCash) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <h3>No access</h3>
        <p>This page is for riders and office staff only.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {canViewFinancials && <FinancialOverviewCard />}
      {myRider && <RiderOutstandingCard rider={myRider} />}
      {canApproveCash && <OfficeSettlementQueue />}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FINANCIAL OVERVIEW — the "all monies" view: rider cash still
   outstanding, expenses, import spend, and revenue, all in one
   place instead of three separate pages. Office staff only.
═══════════════════════════════════════════════════════════════ */
const FinancialOverviewCard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState({ start_date: '', end_date: '' });
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (range.start_date && range.end_date) {
        params.start_date = range.start_date;
        params.end_date = range.end_date;
      }
      const res = await settlementsAPI.getOverview(params);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load financial overview:', err);
      setError(err.response?.data?.message || 'Could not load the financial overview');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const fmt = (n) => `GH₵ ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
  const periodLabel = data?.period?.days
    ? `Last ${data.period.days} days`
    : data?.period
      ? `${data.period.start_date} → ${data.period.end_date}`
      : '';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Financial Overview</h3>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
            All money currently in motion — rider cash, expenses, imports, and revenue{periodLabel ? ` · ${periodLabel}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" className="form-input" style={{ width: 150 }} value={range.start_date}
            onChange={e => setRange(r => ({ ...r, start_date: e.target.value }))} />
          <input type="date" className="form-input" style={{ width: 150 }} value={range.end_date}
            onChange={e => setRange(r => ({ ...r, end_date: e.target.value }))} />
          <button className="btn" onClick={() => setRange({ start_date: '', end_date: '' })}>Reset</button>
        </div>
      </div>

      {loading ? (
        <div className="loading" style={{ padding: '20px 0' }}>
          <div className="loading-spinner" />
          <span className="loading-text">Loading…</span>
        </div>
      ) : error ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>
      ) : (
        <div className="stats-grid" style={{ marginTop: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Rider Cash Outstanding</div>
            <div className="stat-value" style={{ color: data.outstanding_rider_cash > 0 ? '#c2410c' : '#16a34a' }}>
              {fmt(data.outstanding_rider_cash)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              across {data.outstanding_order_count} order{data.outstanding_order_count !== 1 ? 's' : ''}, fleet-wide
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Expenses (Period)</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{fmt(data.period_expenses)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Import Spend</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{fmt(data.import_actual_spent)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              {fmt(data.import_budgeted)} budgeted total
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Revenue (Period)</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>{fmt(data.period_revenue)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Position</div>
            <div className="stat-value" style={{ color: data.net_position >= 0 ? '#16a34a' : '#ef4444' }}>
              {fmt(data.net_position)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              revenue − expenses − import spend
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   RIDER VIEW — outstanding balance + declare settlement
═══════════════════════════════════════════════════════════════ */
const RiderOutstandingCard = ({ rider }) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchOutstanding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settlementsAPI.getOutstanding(rider.id);
      setOrders(res.data.orders || []);
      setTotalOutstanding(res.data.total_outstanding || 0);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to load outstanding balance:', err);
    } finally {
      setLoading(false);
    }
  }, [rider.id]);

  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);

  const toggleOrder = (id) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    setSuccess(false);
  };

  const selectedTotal = orders
    .filter(o => selectedIds.includes(o.id))
    .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  const handleDeclare = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one order to settle');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await settlementsAPI.declare({
        order_ids: selectedIds,
        declared_amount: selectedTotal,
        notes: notes || undefined,
      });
      setNotes('');
      setSuccess(true);
      fetchOutstanding();
    } catch (err) {
      setError(err.response?.data?.message || 'Error declaring settlement');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Loading your balance…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>
        Your Outstanding Balance
      </h3>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 16px' }}>
        Cash you've collected from COD deliveries that hasn't been handed over yet.
      </p>

      <div style={{
        background: totalOutstanding > 0 ? '#fff7ed' : '#f0fdf4',
        border: `1px solid ${totalOutstanding > 0 ? '#fed7aa' : '#bbf7d0'}`,
        borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Total outstanding</span>
        <span style={{ fontSize: '24px', fontWeight: '800', color: totalOutstanding > 0 ? '#c2410c' : '#16a34a' }}>
          GH₵ {totalOutstanding.toFixed(2)}
        </span>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          ✓ Settlement declared. An office staff member will confirm it when you hand over the cash.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>All settled up</h3>
          <p>You have no outstanding COD cash right now.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            {orders.map(o => (
              <label
                key={o.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  marginBottom: '6px', cursor: 'pointer',
                  background: selectedIds.includes(o.id) ? '#f0fdf4' : 'white',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(o.id)}
                    onChange={() => toggleOrder(o.id)}
                  />
                  <span style={{ fontWeight: '600', fontSize: '13px' }}>{o.order_number}</span>
                </span>
                <span style={{ fontWeight: '700', fontSize: '13px' }}>
                  GH₵ {parseFloat(o.total_amount).toFixed(2)}
                </span>
              </label>
            ))}
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>
          )}

          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Handing over at the counter now"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              {selectedIds.length} order{selectedIds.length !== 1 ? 's' : ''} selected — GH₵ {selectedTotal.toFixed(2)}
            </span>
            <button
              className="btn btn-primary"
              onClick={handleDeclare}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? 'Declaring…' : 'Declare Settlement'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   OFFICE VIEW — review queue
═══════════════════════════════════════════════════════════════ */
const OfficeSettlementQueue = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null); // settlement being approved/disputed
  const [approvedAmount, setApprovedAmount] = useState('');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = activeTab === 'pending' ? { status: 'declared' } : {};
      const res = await settlementsAPI.getAll(params);
      setSettlements(res.data.settlements || []);
    } catch (err) {
      console.error('Failed to load settlements:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  const openReview = (settlement) => {
    setReviewing(settlement);
    setApprovedAmount(String(settlement.declared_amount));
    setDisputeNotes('');
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await settlementsAPI.approve(reviewing.id, {
        approved_amount: parseFloat(approvedAmount),
        dispute_notes: disputeNotes || undefined,
      });
      setReviewing(null);
      fetchSettlements();
    } catch (err) {
      alert(err.response?.data?.message || 'Error reviewing settlement');
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const map = {
      declared: { cls: 'badge-amber', label: 'Pending Review' },
      approved: { cls: 'badge-green', label: 'Approved' },
      disputed: { cls: 'badge-red', label: 'Disputed' },
    };
    const s = map[status] || { cls: 'badge-blue', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
        Rider Settlements
      </h3>

      <div className="tabs" style={{ marginBottom: '16px' }}>
        <button
          className={`tab-btn${activeTab === 'pending' ? ' active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Review
        </button>
        <button
          className={`tab-btn${activeTab === 'all' ? ' active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Settlements
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Loading…</span>
        </div>
      ) : settlements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>{activeTab === 'pending' ? 'Nothing pending review' : 'No settlements yet'}</h3>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rider</th>
                <th>Orders</th>
                <th>Declared</th>
                <th>Approved</th>
                <th>Status</th>
                <th>Declared At</th>
                {activeTab === 'pending' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{s.rider_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{s.rider_phone}</div>
                  </td>
                  <td>{s.order_count}</td>
                  <td style={{ fontWeight: '700' }}>GH₵ {parseFloat(s.declared_amount).toFixed(2)}</td>
                  <td>{s.approved_amount != null ? `GH₵ ${parseFloat(s.approved_amount).toFixed(2)}` : '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    {new Date(s.declared_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {activeTab === 'pending' && (
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openReview(s)}>
                        Review
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Review modal ── */}
      {reviewing && (
        <div className="modal-overlay" onClick={() => setReviewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Review Settlement</h2>
              <button className="modal-close" onClick={() => setReviewing(null)}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 16px' }}>
              {reviewing.rider_name} declared <strong>GH₵ {parseFloat(reviewing.declared_amount).toFixed(2)}</strong> across {reviewing.order_count} order(s).
              Count the actual cash handed over and enter it below.
            </p>

            <div className="form-group">
              <label className="form-label">Amount Actually Received (GH₵)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={approvedAmount}
                onChange={e => setApprovedAmount(e.target.value)}
              />
            </div>

            {parseFloat(approvedAmount) !== parseFloat(reviewing.declared_amount) && (
              <div className="form-group">
                <div className="alert alert-warning" style={{ marginBottom: '8px' }}>
                  This doesn't match the declared amount — this settlement will be recorded as disputed.
                </div>
                <label className="form-label">Dispute Note</label>
                <input
                  className="form-input"
                  value={disputeNotes}
                  onChange={e => setDisputeNotes(e.target.value)}
                  placeholder="e.g. Rider was GH₵20 short"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReviewing(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApprove} disabled={submitting || !approvedAmount}>
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlements;
