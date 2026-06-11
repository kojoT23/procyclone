import React, { useState, useEffect, useCallback } from 'react';
import { cashAPI, ridersAPI } from '../utils/api';

/* ─── CSV helper ──────────────────────────────────────────────── */
const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const Cash = () => {
  /* ── State ───────────────────────────────────────────────────── */
  const [logs, setLogs]           = useState([]);
  const [riders, setRiders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [report, setReport]       = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [form, setForm]           = useState({ rider_id: '', amount: '', notes: '' });

  /* ── Filters (Cash Logs tab) ─────────────────────────────────── */
  const [filterDate,  setFilterDate]  = useState('');
  const [filterRider, setFilterRider] = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const PAGE_SIZE = 20;

  /* ── Daily Report date ───────────────────────────────────────── */
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  /* ── Fetch logs ──────────────────────────────────────────────── */
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: PAGE_SIZE, page };
      if (filterDate)  params.date     = filterDate;
      if (filterRider) params.rider_id = filterRider;
      const res = await cashAPI.getAll(params);
      setLogs(res.data.logs || []);
      const total = res.data.total || 0;
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterDate, filterRider]);

  /* ── Fetch riders ────────────────────────────────────────────── */
  const fetchRiders = useCallback(async () => {
    try {
      const res = await ridersAPI.getAll({ limit: 100 });
      setRiders(res.data.riders || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* ── Fetch daily report ──────────────────────────────────────── */
  const fetchReport = useCallback(async () => {
    try {
      const res = await cashAPI.getDailyReport({ date: reportDate });
      setReport(res.data.report || null);
    } catch (err) {
      console.error(err);
    }
  }, [reportDate]);

  useEffect(() => { fetchLogs(); },   [fetchLogs]);
  useEffect(() => { fetchRiders(); }, [fetchRiders]);
  useEffect(() => { fetchReport(); }, [fetchReport]);

  /* Reset page when filters change */
  useEffect(() => { setPage(1); }, [filterDate, filterRider]);

  /* ── Actions ─────────────────────────────────────────────────── */
  const handleVerify = async (id) => {
    try { await cashAPI.verify(id); fetchLogs(); }
    catch { alert('Error verifying cash log'); }
  };

  const handleDispute = async (id) => {
    const notes = window.prompt('Reason for dispute:');
    if (!notes) return;
    try { await cashAPI.dispute(id, { notes }); fetchLogs(); }
    catch { alert('Error disputing cash log'); }
  };

  const handleSave = async () => {
    if (!form.rider_id || !form.amount) return alert('Rider and amount are required');
    try {
      setSaving(true);
      await cashAPI.create(form);
      setShowModal(false);
      setForm({ rider_id: '', amount: '', notes: '' });
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error logging cash');
    } finally {
      setSaving(false);
    }
  };

  /* ── CSV export for daily report ─────────────────────────────── */
  const exportDailyCSV = () => {
    if (!report?.riders?.length) return;
    downloadCSV(
      report.riders.map(r => ({
        Rider:            r.rider_name,
        Phone:            r.phone || '',
        Collections:      r.total_collections || 0,
        'Total (GH₵)':    parseFloat(r.total_amount || 0).toFixed(2),
        Verified:         r.verified || 0,
        Pending:          r.pending  || 0,
        Disputed:         r.disputed || 0,
      })),
      `cash-report-${reportDate}.csv`
    );
  };

  /* ── Summary figures from current page of logs ───────────────── */
  const totalVerified = logs.filter(l => l.status === 'verified').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  const totalPending  = logs.filter(l => l.status === 'pending').reduce((s, l)  => s + parseFloat(l.amount || 0), 0);
  const totalDisputed = logs.filter(l => l.status === 'disputed').reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  const tabs = [
    { key: 'logs',           label: '💰 Cash Logs' },
    { key: 'report',         label: '📊 Daily Report' },
    { key: 'reconciliation', label: '⚖️ Reconciliation' },
  ];

  /* ── Status badge ────────────────────────────────────────────── */
  const StatusBadge = ({ status }) => {
    const cls = status === 'verified' ? 'badge badge-green'
              : status === 'disputed' ? 'badge badge-red'
              : 'badge badge-amber';
    return <span className={cls}>{status}</span>;
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Control</h1>
          <p className="page-subtitle">Track and verify rider cash collections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Log Cash</button>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <p className="stat-label">Verified</p>
          <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>GH₵ {totalVerified.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏳</span>
          <p className="stat-label">Pending</p>
          <p className="stat-value" style={{ color: '#f59e0b' }}>GH₵ {totalPending.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚠️</span>
          <p className="stat-label">Disputed</p>
          <p className="stat-value" style={{ color: '#ef4444' }}>GH₵ {totalDisputed.toFixed(2)}</p>
        </div>
        {report && (
          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <p className="stat-label">Revenue ({reportDate})</p>
            <p className="stat-value" style={{ color: '#3b82f6' }}>GH₵ {parseFloat(report.orders?.total_revenue || 0).toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: Cash Logs
      ══════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '150px' }}
              value={filterRider}
              onChange={e => setFilterRider(e.target.value)}
            >
              <option value="">All Riders</option>
              {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {(filterDate || filterRider) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterDate(''); setFilterRider(''); }}
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">
              <div className="loading-spinner" />
              <span className="loading-text">Loading cash logs…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💰</div>
              <h3>No cash logs found</h3>
              <p>{filterDate || filterRider ? 'No logs match these filters.' : 'Log rider cash collections here.'}</p>
              {!filterDate && !filterRider && (
                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>
                  + Log Cash
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ fontWeight: '600' }}>{log.rider_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{log.rider_phone}</div>
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)', fontSize: '15px' }}>
                          GH₵ {parseFloat(log.amount || 0).toFixed(2)}
                        </td>
                        <td><StatusBadge status={log.status} /></td>
                        <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{log.notes || '—'}</td>
                        <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {log.status === 'pending' && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => handleVerify(log.id)}>✓ Verify</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDispute(log.id)}>⚠ Dispute</button>
                              </>
                            )}
                            {log.status === 'verified' && <span className="badge badge-green">✓ Verified</span>}
                            {log.status === 'disputed' && <span className="badge badge-red">⚠ Disputed</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination" style={{ marginTop: '16px' }}>
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: Daily Report
      ══════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Date picker + export */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" onClick={exportDailyCSV}>
              ⬇ Download CSV
            </button>
          </div>

          {!report ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>No report data</h3>
                <p>No cash activity found for {reportDate}.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Orders summary */}
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                  Orders Summary — {reportDate}
                </h3>
                <div className="stats-grid">
                  {[
                    { label: 'Total Orders', value: report.orders?.total_orders || 0,                                        color: 'var(--navy)' },
                    { label: 'Revenue',       value: `GH₵ ${parseFloat(report.orders?.total_revenue || 0).toFixed(2)}`,      color: 'var(--accent, #22c55e)' },
                    { label: 'Delivered',     value: report.orders?.delivered || 0,                                          color: '#3b82f6' },
                    { label: 'Failed',        value: report.orders?.failed || 0,                                             color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
                      <p style={{ fontSize: '24px', fontWeight: '800', color, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cash summary */}
              {report.cash && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Cash Collections</h3>
                  <div className="stats-grid">
                    {[
                      { label: 'Total Cash',  value: `GH₵ ${parseFloat(report.cash.total_cash || 0).toFixed(2)}`, color: 'var(--accent, #22c55e)' },
                      { label: 'Verified',    value: report.cash.verified || 0,  color: 'var(--accent, #22c55e)' },
                      { label: 'Pending',     value: report.cash.pending  || 0,  color: '#f59e0b' },
                      { label: 'Disputed',    value: report.cash.disputed || 0,  color: '#ef4444' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: '22px', fontWeight: '800', color, margin: 0 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment breakdown */}
              {report.payment_breakdown?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Payment Methods</h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {report.payment_breakdown.map(p => (
                      <div key={p.payment_method} style={{
                        flex: 1, minWidth: '120px', textAlign: 'center',
                        padding: '16px', background: '#f8fafc', borderRadius: '10px',
                      }}>
                        <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.05em' }}>
                          {p.payment_method}
                        </p>
                        <p style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 4px' }}>
                          {p.count} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)' }}>orders</span>
                        </p>
                        <p style={{ color: 'var(--accent, #22c55e)', fontWeight: '700', margin: 0, fontSize: '15px' }}>
                          GH₵ {parseFloat(p.total || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rider collections */}
              {report.riders?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Rider Collections</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Rider</th>
                          <th>Collections</th>
                          <th>Total Amount</th>
                          <th>Verified</th>
                          <th>Pending</th>
                          <th>Disputed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.riders.map((r, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{r.rider_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.phone}</div>
                            </td>
                            <td>{r.total_collections || 0}</td>
                            <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                              GH₵ {parseFloat(r.total_amount || 0).toFixed(2)}
                            </td>
                            <td><span className="badge badge-green">{r.verified || 0}</span></td>
                            <td><span className="badge badge-amber">{r.pending  || 0}</span></td>
                            <td><span className="badge badge-red">{r.disputed || 0}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: Reconciliation
      ══════════════════════════════════════════ */}
      {activeTab === 'reconciliation' && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Rider Reconciliation</h3>
          <p className="page-subtitle" style={{ margin: '0 0 20px' }}>
            Flags riders with disputes or pending balances over GH₵ 100.
          </p>

          {riders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚖️</div>
              <h3>No riders yet</h3>
              <p>Add riders to see reconciliation</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Total Logged</th>
                    <th>Verified</th>
                    <th>Pending</th>
                    <th>Disputed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {riders.map(rider => {
                    const riderLogs = logs.filter(l => l.rider_id === rider.id);
                    const verified  = riderLogs.filter(l => l.status === 'verified').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
                    const pending   = riderLogs.filter(l => l.status === 'pending').reduce((s, l)  => s + parseFloat(l.amount || 0), 0);
                    const disputed  = riderLogs.filter(l => l.status === 'disputed').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
                    const total     = verified + pending + disputed;
                    const hasShortfall = disputed > 0 || pending > 100;
                    return (
                      <tr
                        key={rider.id}
                        style={hasShortfall ? { background: '#fef2f2', borderLeft: '3px solid #ef4444' } : {}}
                      >
                        <td>
                          <div style={{ fontWeight: '600' }}>{rider.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{rider.phone}</div>
                        </td>
                        <td style={{ fontWeight: '700' }}>GH₵ {total.toFixed(2)}</td>
                        <td style={{ color: 'var(--accent, #22c55e)', fontWeight: '600' }}>GH₵ {verified.toFixed(2)}</td>
                        <td style={{ color: '#f59e0b', fontWeight: '600' }}>GH₵ {pending.toFixed(2)}</td>
                        <td style={{ color: '#ef4444', fontWeight: '600' }}>GH₵ {disputed.toFixed(2)}</td>
                        <td>
                          {hasShortfall
                            ? <span className="badge badge-red">⚠ Shortfall</span>
                            : <span className="badge badge-green">✓ OK</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-3)' }}>
            ⚠ Shortfall flagged when disputed &gt; 0 or pending &gt; GH₵ 100.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════
          Modal — Log Cash
      ══════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Log Cash Collection</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rider *</label>
              <select className="form-input" value={form.rider_id} onChange={e => setForm(f => ({ ...f, rider_id: e.target.value }))}>
                <option value="">Select rider…</option>
                {riders.map(r => <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount Collected (GH₵) *</label>
              <input
                className="form-input"
                type="number" min="0" step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Log Cash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cash;
