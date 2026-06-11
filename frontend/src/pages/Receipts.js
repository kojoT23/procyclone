import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation } from 'react-router-dom';
import { ordersAPI } from '../utils/api';
import './Receipts.css';

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

/* ─── Payment method helpers ──────────────────────────────────── */
const getPaymentLabel = (method) => {
  if (method === 'momo') return 'MTN MoMo';
  if (method === 'cod')  return 'Cash on Delivery';
  if (method === 'cash') return 'Cash (Paid)';
  return method?.toUpperCase() || '—';
};

const paymentBadgeClass = (method) => {
  if (method === 'momo') return 'badge badge-blue';
  if (method === 'cod')  return 'badge badge-amber';
  if (method === 'cash') return 'badge badge-green';
  return 'badge badge-gray';
};

const statusBadgeClass = (status) => {
  const map = {
    pending:          'badge badge-amber',
    confirmed:        'badge badge-blue',
    packing:          'badge badge-purple',
    assigned:         'badge badge-teal',
    out_for_delivery: 'badge badge-amber',
    delivered:        'badge badge-green',
    failed:           'badge badge-red',
    returned:         'badge badge-gray',
  };
  return map[status] || 'badge badge-gray';
};

/* ═══════════════════════════════════════════════════════════════
   RECEIPT PRINT DOCUMENT
   — renders for each selected order in the hidden print area
═══════════════════════════════════════════════════════════════ */
const ReceiptDocument = ({ order }) => {
  if (!order) return null;
  const items   = order.items || [];
  const isMomo  = order.payment_method === 'momo';
  const isCod   = order.payment_method === 'cod';
  const isCash  = order.payment_method === 'cash';
  const momoRef = order.payment_reference || null;

  return (
    <div className="receipt-print-page">
      {/* Header */}
      <div className="receipt-print-header">
        <div className="receipt-brand">
          <div className="receipt-logo">SW</div>
          <div>
            <div className="receipt-brand-name">Shorewinds</div>
            <div className="receipt-brand-sub">Official Receipt</div>
          </div>
        </div>
        <div className="receipt-meta">
          <div className="receipt-order-num">{order.order_number}</div>
          <div className="receipt-date">{fmtDate(order.created_at)}</div>
        </div>
      </div>

      <div className="receipt-divider" />

      {/* Info grid */}
      <div className="receipt-info-grid">
        <div className="receipt-info-block">
          <div className="receipt-info-label">Customer</div>
          <div className="receipt-info-value">{order.customer_name || '—'}</div>
          {order.customer_phone && <div className="receipt-info-sub">{order.customer_phone}</div>}
          {order.delivery_address && <div className="receipt-info-sub">{order.delivery_address}</div>}
        </div>
        <div className="receipt-info-block">
          <div className="receipt-info-label">Rider</div>
          <div className="receipt-info-value">{order.rider_name || 'Unassigned'}</div>
          {order.rider_phone && <div className="receipt-info-sub">{order.rider_phone}</div>}
        </div>
        <div className="receipt-info-block">
          <div className="receipt-info-label">Payment</div>
          <div className="receipt-info-value">{getPaymentLabel(order.payment_method)}</div>
          {isMomo && momoRef && (
            <div className="receipt-momo-ref">
              Ref: <strong>{momoRef}</strong>
            </div>
          )}
          {isMomo && !momoRef && (
            <div className="receipt-momo-ref">MoMo — No reference recorded</div>
          )}
          {isCod && (
            <div className="receipt-momo-ref" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#ea580c' }}>
              To be collected on delivery
            </div>
          )}
          {isCash && (
            <div className="receipt-momo-ref" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
              Paid in full
            </div>
          )}
        </div>
        <div className="receipt-info-block">
          <div className="receipt-info-label">Status</div>
          <div className="receipt-info-value receipt-status">
            {order.status?.replace(/_/g, ' ').toUpperCase() || '—'}
          </div>
          {order.notes && (
            <div className="receipt-info-sub" style={{ fontStyle: 'italic' }}>{order.notes}</div>
          )}
        </div>
      </div>

      <div className="receipt-divider" />

      {/* Items */}
      <div className="receipt-section-title">Items Ordered</div>
      {items.length > 0 ? (
        <table className="receipt-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.product_name}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{fmt(item.unit_price)}</td>
                <td className="text-right">{fmt(item.quantity * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '0.5rem 0' }}>No items found</div>
      )}

      <div className="receipt-divider" />

      {/* Totals */}
      <div className="receipt-totals">
        {order.delivery_fee > 0 && (
          <div className="receipt-total-row">
            <span>Delivery Fee</span>
            <span>{fmt(order.delivery_fee)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="receipt-total-row">
            <span>Discount</span>
            <span>− {fmt(order.discount)}</span>
          </div>
        )}
        <div className="receipt-total-row receipt-grand-total">
          <span>{isCod ? 'Amount Due on Delivery' : 'Total Paid'}</span>
          <span>{fmt(order.total_amount)}</span>
        </div>
      </div>

      {/* MoMo notice */}
      {isMomo && (
        <>
          <div className="receipt-divider" />
          <div style={{ fontSize: '0.78rem', color: '#475569', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
            <strong>MTN MoMo Payment</strong> — Funds sent to <strong>Shorewinds</strong>.
            {momoRef ? <> Reference: <strong>{momoRef}</strong></> : ' No reference recorded.'}
          </div>
        </>
      )}

      {/* COD signature block */}
      {isCod && (
        <>
          <div className="receipt-divider" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginTop: '8px' }}>
            <div>
              <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '6px' }} />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }}>Rider / Agent Signature</div>
              <div style={{ fontSize: '0.78rem', color: '#0f172a', marginTop: '2px' }}>{order.rider_name || '________________________'}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>Date: ___________________</div>
            </div>
            <div>
              <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '6px' }} />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }}>Customer Signature</div>
              <div style={{ fontSize: '0.78rem', color: '#0f172a', marginTop: '2px' }}>{order.customer_name || '________________________'}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>Date: ___________________</div>
            </div>
          </div>
        </>
      )}

      <div className="receipt-divider" />

      {/* Footer + QR */}
      <div className="receipt-print-footer">
        <div className="receipt-qr">
          <QRCodeSVG
            value={JSON.stringify({
              order:   order.order_number,
              customer: order.customer_name,
              amount:  order.total_amount,
              payment: getPaymentLabel(order.payment_method),
              ref:     momoRef || null,
              date:    order.created_at,
            })}
            size={90}
            level="M"
          />
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem' }}>Scan to verify order</div>
        </div>
        <p>Thank you for shopping with us!</p>
        <p>Shorewinds — [Address] · [Phone] · [Website]</p>
        <p style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '4px' }}>Powered by ProCyclone</p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN RECEIPTS PAGE
═══════════════════════════════════════════════════════════════ */
const Receipts = () => {
  const location = useLocation();

  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected,     setSelected]     = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [printing,     setPrinting]     = useState(false);

  /* ── Fetch orders (paginated) ────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search)                        params.search = search;
      if (filterStatus !== 'all')        params.status = filterStatus;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data.orders || []);
      setTotal(res.data.total   || 0);
      setPages(res.data.pages   || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); },    [search, filterStatus]);

  /* Auto-select order if navigated from elsewhere */
  useEffect(() => {
    if (location.state?.newOrderId) {
      setSelected([location.state.newOrderId]);
    }
  }, [location.state]);

  /* ── Select / deselect ───────────────────────────────────────── */
  const toggleSelect    = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSelectAll = () => setSelected(selected.length === orders.length ? [] : orders.map(o => o.id));

  /* ── Print ───────────────────────────────────────────────────── */
  const handlePrint = async () => {
    if (!selected.length) return alert('Please select at least one order to print.');
    try {
      setPrinting(true);
      const details = {};
      await Promise.all(selected.map(async (id) => {
        try {
          const res = await ordersAPI.getOne(id);
          details[id] = res.data.order;
        } catch { /* skip failed */ }
      }));
      setOrderDetails(details);
      setTimeout(() => window.print(), 400);
    } finally {
      setPrinting(false);
    }
  };

  /* ── Selected order objects ──────────────────────────────────── */
  const selectedOrderObjects = selected.map(id => orderDetails[id] || orders.find(o => o.id === id)).filter(Boolean);

  const STATUS_TABS = ['all', 'pending', 'confirmed', 'packing', 'assigned', 'out_for_delivery', 'delivered', 'failed', 'returned'];

  return (
    <div className="receipts-page">

      {/* ── Hidden print area ─────────────────────────────────── */}
      <div className="print-only">
        {selectedOrderObjects.map((order, idx) => (
          <React.Fragment key={order.id}>
            <ReceiptDocument order={order} />
            {idx < selectedOrderObjects.length - 1 && <div className="receipt-page-break" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Screen UI ─────────────────────────────────────────── */}
      <div className="no-print">
        <div className="page-header">
          <div>
            <h1 className="page-title">Receipts</h1>
            <p className="page-subtitle">Select orders and print single or bulk receipts</p>
          </div>
          <div className="receipts-header-actions">
            {selected.length > 0 && (
              <span className="badge badge-green">{selected.length} selected</span>
            )}
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={selected.length === 0 || printing}
            >
              🖨️ {printing ? 'Preparing…' : selected.length > 1 ? `Print ${selected.length} Receipts` : 'Print Receipt'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="receipts-filters">
            <input
              className="form-input"
              placeholder="🔍 Search order # or customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <div className="tabs" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
              {STATUS_TABS.map(s => (
                <button
                  key={s}
                  className={`tab-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>Orders</h3>
            <span className="badge badge-gray">{total} total</span>
          </div>

          {loading ? (
            <div className="loading">
              <div className="loading-spinner" />
              <span className="loading-text">Loading orders…</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧾</div>
              <h3>No orders found</h3>
              <p>{search || filterStatus !== 'all' ? 'No orders match your filters.' : 'Orders will appear here once created.'}</p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="receipt-checkbox"
                          checked={selected.length === orders.length && orders.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Rider</th>
                      <th>Payment</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr
                        key={order.id}
                        className={selected.includes(order.id) ? 'receipt-row-selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleSelect(order.id)}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="receipt-checkbox"
                            checked={selected.includes(order.id)}
                            onChange={() => toggleSelect(order.id)}
                          />
                        </td>
                        <td>
                          <strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {order.order_number}
                          </strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{order.customer_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{order.customer_phone}</div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                          {order.rider_name || <span className="badge badge-gray">Unassigned</span>}
                        </td>
                        <td>
                          <span className={paymentBadgeClass(order.payment_method)}>
                            {getPaymentLabel(order.payment_method)}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                          {fmt(order.total_amount)}
                        </td>
                        <td>
                          <span className={statusBadgeClass(order.status)}>
                            {order.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {fmtDate(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="pagination" style={{ marginTop: '16px' }}>
                  <span className="pagination-info">Page {page} of {pages} · {total} orders</span>
                  <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Selection summary */}
        {selected.length > 0 && (
          <div className="alert alert-info" style={{ marginTop: '16px' }}>
            <strong>{selected.length} order{selected.length > 1 ? 's' : ''} selected.</strong>
            {' '}Click <strong>Print Receipt</strong> to generate printable receipts.
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: '12px' }}
              onClick={() => setSelected([])}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receipts;
