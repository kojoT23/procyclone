import React, { useState, useEffect, useCallback, useRef } from 'react';
import { paymentsAPI, ordersAPI } from '../utils/api';
import './CodReceipt.css';

/* ─── CSV helper ───────────────────────────────────────────────── */
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

/* ─── Small presentational components ───────────────────────────── */
const MethodBadge = ({ method }) => {
  const cls =
    method === 'momo' ? 'badge badge-blue'   :
    method === 'cod'  ? 'badge badge-amber'  :
    method === 'cash' ? 'badge badge-green'  :
    method === 'card' ? 'badge badge-purple' : 'badge badge-gray';
  const label =
    method === 'momo' ? 'MTN MoMo' :
    method === 'cod'  ? 'Cash on Delivery' :
    method === 'cash' ? 'Cash on Delivery' :
    method?.toUpperCase() || '—';
  return <span className={cls}>{label}</span>;
};

const StatusBadge = ({ status }) => {
  const cls =
    status === 'verified' ? 'badge badge-green'  :
    status === 'failed'   ? 'badge badge-red'    :
    status === 'refunded' ? 'badge badge-purple' : 'badge badge-amber';
  return <span className={cls}>{status}</span>;
};

/* ═══════════════════════════════════════════════════════════════════
   COD RECEIPT — rendered into a hidden div, printed via window.print()
   Only shown / generated for method === 'cod'
═══════════════════════════════════════════════════════════════════ */
const CodReceiptDocument = React.forwardRef(({ payment, order }, ref) => {
  if (!payment || !order) return null;
  const items    = order.items || [];
  const receiptNo = `REC-${payment.id?.toString().padStart(5, '0')}`;
  const now       = new Date().toLocaleString('en-GH', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div ref={ref} className="cod-receipt">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="cod-receipt__header">
        <div className="cod-receipt__brand">
          <div className="cod-receipt__logo">SW</div>
          <div>
            <div className="cod-receipt__brand-name">Shorewinds</div>
            <div className="cod-receipt__brand-sub">[Address line 1]</div>
            <div className="cod-receipt__brand-sub">[City, Region · Phone]</div>
          </div>
        </div>
        <div className="cod-receipt__meta">
          <div className="cod-receipt__title">CASH RECEIPT</div>
          <div className="cod-receipt__ref">{receiptNo}</div>
          <div className="cod-receipt__date">{now}</div>
        </div>
      </div>

      <div className="cod-receipt__rule" />

      {/* ── Party info ──────────────────────────────────────── */}
      <div className="cod-receipt__parties">
        <div className="cod-receipt__party">
          <div className="cod-receipt__party-label">Bill To</div>
          <div className="cod-receipt__party-name">{payment.customer_name || '—'}</div>
          <div className="cod-receipt__party-sub">{payment.customer_phone}</div>
          {order.delivery_address && (
            <div className="cod-receipt__party-sub">{order.delivery_address}</div>
          )}
        </div>
        <div className="cod-receipt__party">
          <div className="cod-receipt__party-label">Order</div>
          <div className="cod-receipt__party-name">{payment.order_number}</div>
          <div className="cod-receipt__party-sub">Payment: Cash on Delivery</div>
          {order.rider_name && (
            <div className="cod-receipt__party-sub">Rider: {order.rider_name}</div>
          )}
        </div>
      </div>

      <div className="cod-receipt__rule" />

      {/* ── Items table ─────────────────────────────────────── */}
      <div className="cod-receipt__section-label">Items</div>
      <table className="cod-receipt__items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="right">Qty</th>
            <th className="right">Unit Price</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item, i) => (
            <tr key={i}>
              <td>{item.product_name}</td>
              <td className="right">{item.quantity}</td>
              <td className="right">{fmt(item.unit_price)}</td>
              <td className="right">{fmt(item.quantity * item.unit_price)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={4} style={{ color: '#94a3b8', textAlign: 'center', padding: '8px' }}>
                No items on record
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="cod-receipt__rule" />

      {/* ── Totals ──────────────────────────────────────────── */}
      <div className="cod-receipt__totals">
        {order.delivery_fee > 0 && (
          <div className="cod-receipt__total-row">
            <span>Delivery Fee</span>
            <span>{fmt(order.delivery_fee)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="cod-receipt__total-row">
            <span>Discount</span>
            <span>− {fmt(order.discount)}</span>
          </div>
        )}
        <div className="cod-receipt__total-row cod-receipt__grand">
          <span>TOTAL RECEIVED</span>
          <span>{fmt(payment.amount)}</span>
        </div>
      </div>

      <div className="cod-receipt__rule" />

      {/* ── Confirmation statement ───────────────────────────── */}
      <div className="cod-receipt__statement">
        I, the undersigned, hereby confirm receipt of the above payment of{' '}
        <strong>{fmt(payment.amount)}</strong> in cash for order{' '}
        <strong>{payment.order_number}</strong> on behalf of{' '}
        <strong>Shorewinds</strong>.
      </div>

      {/* ── Signature block ─────────────────────────────────── */}
      <div className="cod-receipt__sigs">
        <div className="cod-receipt__sig">
          <div className="cod-receipt__sig-line" />
          <div className="cod-receipt__sig-label">Rider / Agent Signature</div>
          <div className="cod-receipt__sig-name">{order.rider_name || '________________________'}</div>
          <div className="cod-receipt__sig-label">Date: ___________________</div>
        </div>
        <div className="cod-receipt__sig">
          <div className="cod-receipt__sig-line" />
          <div className="cod-receipt__sig-label">Customer Signature</div>
          <div className="cod-receipt__sig-name">{payment.customer_name || '________________________'}</div>
          <div className="cod-receipt__sig-label">Date: ___________________</div>
        </div>
      </div>

      <div className="cod-receipt__rule" />

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="cod-receipt__footer">
        <p>Thank you for your purchase — Shorewinds</p>
        <p>[Website] · [Email] · [Phone]</p>
        <p style={{ marginTop: '6px', fontSize: '9px', color: '#94a3b8' }}>
          Powered by Shorewinds · Receipt #{receiptNo}
        </p>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAYMENTS PAGE
═══════════════════════════════════════════════════════════════════ */
const Payments = () => {
  /* List */
  const [payments,     setPayments]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);

  /* Filters */
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterDate,   setFilterDate]   = useState('');

  /* Summary */
  const [summary,      setSummary]      = useState(null);

  /* MoMo verify modal */
  const [verifying,       setVerifying]       = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [reference,       setReference]       = useState('');

  /* COD receipt */
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPayment,   setReceiptPayment]   = useState(null);
  const [receiptOrder,     setReceiptOrder]     = useState(null);
  const [loadingOrder,     setLoadingOrder]     = useState(false);
  const receiptRef = useRef();

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterMethod) params.method = filterMethod;
      if (filterDate)   params.date   = filterDate;

      const paymentsRes = await paymentsAPI.getAll(params);
      setPayments(paymentsRes.data.payments || []);
      setTotal(paymentsRes.data.total  || 0);
      setPages(paymentsRes.data.pages  || 1);

      // Summary is non-critical — don't let it crash the payments list
      try {
        const summaryRes = await paymentsAPI.getSummary({ date: filterDate || undefined });
        setSummary(summaryRes.data);
      } catch (summaryErr) {
        console.warn('Summary fetch failed:', summaryErr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterMethod, filterDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); },  [filterStatus, filterMethod, filterDate]);

  /* ── Derived summary ──────────────────────────────────────── */
  const globalPending = summary?.pending_verification;
  const summaryRows   = summary?.summary || [];
  const totalVerified = summaryRows.filter(r => r.status === 'verified').reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const momoVerified  = summaryRows.filter(r => r.method === 'momo' && r.status === 'verified').reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const cashVerified  = summaryRows.filter(r => (r.method === 'cod' || r.method === 'cash') && r.status === 'verified').reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalRevenue  = summaryRows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const pendingOnPage = payments.filter(p => p.status === 'pending').length;

  /* ── MoMo verify ───────────────────────────────────────────── */
  const openVerify = (payment) => {
    setSelectedPayment(payment);
    setReference('');
    setShowVerifyModal(true);
  };

  const handleVerify = async () => {
    try {
      setVerifying(selectedPayment.id);
      await paymentsAPI.verify(selectedPayment.id, { reference });
      setShowVerifyModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error verifying payment');
    } finally {
      setVerifying(null);
    }
  };

  /* ── COD: verify + generate receipt ────────────────────────── */
  const handleCodVerify = async (payment) => {
    if (!window.confirm(`Confirm that rider has received GH₵ ${parseFloat(payment.amount).toFixed(2)} cash from ${payment.customer_name}?`)) return;
    try {
      setVerifying(payment.id);
      await paymentsAPI.verify(payment.id, { reference: 'CASH-COD' });

      // Fetch full order details for receipt
      setLoadingOrder(true);
      const orderRes = await ordersAPI.getOne(payment.order_id);
      setReceiptOrder(orderRes.data.order);
      setReceiptPayment(payment);
      setShowReceiptModal(true);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error confirming COD payment');
    } finally {
      setVerifying(null);
      setLoadingOrder(false);
    }
  };

  /* ── Print receipt ─────────────────────────────────────────── */
  const handlePrintReceipt = () => {
    window.print();
  };

  /* ── View existing receipt for already-verified COD ────────── */
  const handleViewReceipt = async (payment) => {
    try {
      setLoadingOrder(true);
      const orderRes = await ordersAPI.getOne(payment.order_id);
      setReceiptOrder(orderRes.data.order);
      setReceiptPayment(payment);
      setShowReceiptModal(true);
    } catch {
      alert('Could not load order details for receipt');
    } finally {
      setLoadingOrder(false);
    }
  };

  /* ── Fail payment ──────────────────────────────────────────── */
  const handleFail = async (id) => {
    if (!window.confirm('Mark this payment as failed?')) return;
    try {
      await paymentsAPI.fail(id);
      fetchData();
    } catch {
      alert('Error updating payment');
    }
  };

  /* ── CSV export ────────────────────────────────────────────── */
  const exportCSV = () => {
    downloadCSV(
      payments.map(p => ({
        Order:           p.order_number || '',
        Customer:        p.customer_name || '',
        Phone:           p.customer_phone || '',
        Method:          p.method === 'cash' ? 'Cash on Delivery' : p.method === 'momo' ? 'MTN MoMo' : p.method,
        'Amount (GH₵)':  parseFloat(p.amount || 0).toFixed(2),
        'MoMo Reference': p.reference || '',
        Status:          p.status,
        'Verified By':   p.verified_by_name || '',
        'Verified At':   p.verified_at ? fmtDate(p.verified_at) : '',
        'Created At':    fmtDate(p.created_at),
      })),
      `payments-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Hidden receipt — shown only on print ────────────────── */}
      <div className="cod-receipt-print-wrapper">
        <CodReceiptDocument
          ref={receiptRef}
          payment={receiptPayment}
          order={receiptOrder}
        />
      </div>

      {/* ── Screen UI ──────────────────────────────────────────── */}
      <div className="no-print">

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">
              {total} total payments
              {globalPending?.count > 0 && ` · ${globalPending.count} awaiting verification`}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <p className="stat-label">Pending Verification</p>
            <p className="stat-value" style={{ color: '#f59e0b' }}>
              {fmt(globalPending?.total || 0)}
            </p>
            <p className="stat-sub">{globalPending?.count || 0} payments waiting</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">📱</span>
            <p className="stat-label">MoMo Verified Today</p>
            <p className="stat-value" style={{ color: '#3b82f6' }}>
              {fmt(momoVerified)}
            </p>
            <p className="stat-sub">MTN Mobile Money</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💵</span>
            <p className="stat-label">Cash Verified Today</p>
            <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>
              {fmt(cashVerified)}
            </p>
            <p className="stat-sub">Cash on Delivery</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <p className="stat-label">Verification Rate</p>
            <p className="stat-value" style={{ color: '#8b5cf6' }}>
              {totalRevenue > 0 ? ((totalVerified / totalRevenue) * 100).toFixed(0) : 0}%
            </p>
            <p className="stat-sub">of today's payments confirmed</p>
          </div>
        </div>

        {/* Payment method explanation cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid #3b82f6', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '28px', lineHeight: 1 }}>📱</div>
            <div>
              <p style={{ fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>MTN MoMo</p>
              <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Customer pays via mobile money before or at delivery. Verify by checking your MTN account and entering the MoMo reference number.
              </p>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '28px', lineHeight: 1 }}>💵</div>
            <div>
              <p style={{ fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Cash on Delivery</p>
              <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Rider collects cash at the door. Confirm the rider received payment, then a signable receipt is automatically generated for the customer.
              </p>
            </div>
          </div>
        </div>

        {/* Pending alert */}
        {pendingOnPage > 0 && (
          <div className="alert alert-warning">
            <strong>⚠️ {pendingOnPage} pending payment{pendingOnPage > 1 ? 's' : ''} on this page.</strong>
            {' '}MoMo — verify via MTN app. Cash on Delivery — confirm rider has collected, then print a receipt.
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="search-bar">
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
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '160px' }}
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value)}
            >
              <option value="">All methods</option>
              <option value="momo">MTN MoMo</option>
              <option value="cod">Cash on Delivery</option>
            </select>
            {(filterStatus || filterMethod || filterDate) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterStatus(''); setFilterMethod(''); setFilterDate(''); }}
              >
                Clear
              </button>
            )}
            <span className="pagination-info" style={{ marginLeft: 'auto' }}>
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner" />
              <span className="loading-text">Loading payments…</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💳</div>
              <h3>No payments found</h3>
              <p>
                {filterStatus || filterMethod || filterDate
                  ? 'No payments match your current filters.'
                  : 'Payments are created automatically when orders are placed.'}
              </p>
              {(filterStatus || filterMethod || filterDate) && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '16px' }}
                  onClick={() => { setFilterStatus(''); setFilterMethod(''); setFilterDate(''); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>MoMo Ref</th>
                      <th>Status</th>
                      <th>Confirmed By</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(payment => (
                      <tr
                        key={payment.id}
                        style={
                          payment.status === 'pending'
                            ? { borderLeft: '3px solid #f59e0b' }
                            : {}
                        }
                      >
                        <td style={{ fontWeight: '600' }}>{payment.order_number || '—'}</td>
                        <td>
                          <div style={{ fontWeight: '500' }}>{payment.customer_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                            {payment.customer_phone}
                          </div>
                        </td>
                        <td>
                          <MethodBadge method={payment.method} />
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)', fontSize: '15px' }}>
                          {fmt(payment.amount)}
                        </td>
                        <td>
                          {payment.method === 'momo' ? (
                            payment.reference ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: '12px',
                                background: '#eff6ff', color: '#1d4ed8',
                                padding: '2px 7px', borderRadius: '4px',
                                letterSpacing: '.04em',
                              }}>
                                {payment.reference}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>No ref yet</span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>N/A</span>
                          )}
                        </td>
                        <td><StatusBadge status={payment.status} /></td>
                        <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>
                          {payment.verified_by_name || '—'}
                          {payment.verified_at && (
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                              {fmtDate(payment.verified_at)}
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {fmtDate(payment.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {payment.status === 'pending' && payment.method === 'momo' && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => openVerify(payment)}
                                  disabled={verifying === payment.id}
                                >
                                  ✓ Verify
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleFail(payment.id)}
                                >
                                  ✕ Fail
                                </button>
                              </>
                            )}

                            {payment.status === 'pending' && (payment.method === 'cod' || payment.method === 'cash') && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleCodVerify(payment)}
                                  disabled={verifying === payment.id || loadingOrder}
                                >
                                  💵 Confirm &amp; Receipt
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleFail(payment.id)}
                                >
                                  ✕ Fail
                                </button>
                              </>
                            )}

                            {payment.status === 'verified' && (payment.method === 'cod' || payment.method === 'cash') && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleViewReceipt(payment)}
                                disabled={loadingOrder}
                              >
                                🧾 Receipt
                              </button>
                            )}

                            {payment.status === 'verified' && payment.method === 'momo' && (
                              <span className="badge badge-green">✓ Verified</span>
                            )}

                            {payment.status === 'failed' && (
                              <span className="badge badge-red">✕ Failed</span>
                            )}
                            {payment.status === 'refunded' && (
                              <span className="badge badge-purple">↩ Refunded</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="pagination">
                  <span className="pagination-info">
                    Page {page} of {pages} · {total} payments
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >← Prev</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page === pages}
                    onClick={() => setPage(p => p + 1)}
                  >Next →</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Today's breakdown table */}
        {summaryRows.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 14px' }}>
              Today's Breakdown
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, i) => (
                    <tr key={i}>
                      <td><MethodBadge method={row.method} /></td>
                      <td><StatusBadge status={row.status} /></td>
                      <td style={{ fontWeight: '600' }}>{row.count}</td>
                      <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                        {fmt(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MoMo Verify Modal ────────────────────────────────── */}
        {showVerifyModal && selectedPayment && (
          <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Verify MoMo Payment</h2>
                <button className="modal-close" onClick={() => setShowVerifyModal(false)}>✕</button>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                padding: '16px', marginBottom: '16px',
              }}>
                {[
                  { label: 'Order',    value: selectedPayment.order_number },
                  { label: 'Amount',   value: fmt(selectedPayment.amount), accent: true },
                  { label: 'Customer', value: selectedPayment.customer_name },
                  { label: 'Phone',    value: selectedPayment.customer_phone },
                ].map(({ label, value, accent }) => (
                  <div key={label}>
                    <p style={{ color: 'var(--text-3)', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '.05em', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontWeight: accent ? '800' : '600', fontSize: accent ? '20px' : '14px', color: accent ? 'var(--accent)' : 'inherit', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                📱 Check your MTN MoMo app or dial <strong>*170#</strong> to confirm you received this payment before verifying.
              </div>

              <div className="form-group">
                <label className="form-label">
                  MoMo Transaction Reference
                  <span style={{ color: 'var(--text-3)', fontWeight: '400', marginLeft: '4px' }}>(recommended)</span>
                </label>
                <input
                  className="form-input"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. MP240601123456"
                />
                <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '4px 0 0' }}>
                  Found in your MoMo confirmation SMS. Entering it creates an audit trail.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowVerifyModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  style={{ flex: 1 }}
                  onClick={handleVerify}
                  disabled={!!verifying}
                >
                  {verifying ? 'Verifying…' : '✓ Confirm Payment Received'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── COD Receipt Modal ─────────────────────────────────── */}
        {showReceiptModal && receiptPayment && (
          <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
            <div
              className="modal"
              style={{ maxWidth: '680px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">🧾 Cash Receipt — {receiptPayment.order_number}</h2>
                <button className="modal-close" onClick={() => setShowReceiptModal(false)}>✕</button>
              </div>

              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                <strong>✓ Payment confirmed.</strong> Print this receipt and have the customer sign it as proof of payment.
              </div>

              {/* Receipt preview */}
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '24px',
                background: '#fff',
                maxHeight: '55vh',
                overflowY: 'auto',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                <CodReceiptDocument
                  payment={receiptPayment}
                  order={receiptOrder}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowReceiptModal(false)}
                >
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handlePrintReceipt}
                >
                  🖨️ Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}

      </div>{/* end .no-print */}
    </>
  );
};

export default Payments;
