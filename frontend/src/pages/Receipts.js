import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation } from 'react-router-dom';
import { ordersAPI } from '../utils/api';
import './Receipts.css';

const Receipts = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const printRef = useRef();
  const location = useLocation();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (location.state?.newOrderId && orders.length > 0) {
      setSelected([location.state.newOrderId]);
    }
  }, [location.state, orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersAPI.getAll();
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter(o => {
    const matchSearch =
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map(o => o.id));
    }
  };

  const selectedOrders = orders.filter(o => selected.includes(o.id));



  const formatCurrency = (amount) =>
    'GHS ' + parseFloat(amount || 0).toFixed(2);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const statusColor = (status) => {
    const map = {
      pending: 'badge-amber',
      confirmed: 'badge-blue',
      delivered: 'badge-green',
      cancelled: 'badge-red',
      processing: 'badge-purple',
    };
    return map[status] || 'badge-gray';
  };

  const paymentColor = (method) => {
    const map = {
      cash: 'badge-green',
      momo: 'badge-blue',
      card: 'badge-purple',
      bank: 'badge-teal',
    };
    return map[method] || 'badge-gray';
  };

  return (
    <div className="receipts-page">
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
              disabled={selected.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              {selected.length > 1 ? 'Print ' + selected.length + ' Receipts' : 'Print Receipt'}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="receipts-filters">
            <div className="search-bar">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search order # or customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {['all','pending','confirmed','processing','delivered','cancelled'].map(s => (
                <button
                  key={s}
                  className={'tab-btn' + (filterStatus === s ? ' active' : '')}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Orders</h3>
            <span className="badge badge-gray">{filtered.length} orders</span>
          </div>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"/>
              <span className="loading-text">Loading orders...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧾</div>
              <p>No orders found</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="receipt-checkbox"
                        checked={selected.length === filtered.length && filtered.length > 0}
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
                  {filtered.map(order => (
                    <tr
                      key={order.id}
                      className={selected.includes(order.id) ? 'receipt-row-selected' : ''}
                      onClick={() => toggleSelect(order.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="receipt-checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                      <td><strong>{order.order_number}</strong></td>
                      <td>{order.customer_name || '-'}</td>
                      <td>{order.rider_name || <span className="badge badge-gray">Unassigned</span>}</td>
                      <td>
                        <span className={'badge ' + paymentColor(order.payment_method)}>
                          {order.payment_method ? order.payment_method.toUpperCase() : '-'}
                        </span>
                      </td>
                      <td><strong>{formatCurrency(order.total_amount)}</strong></td>
                      <td>
                        <span className={'badge ' + statusColor(order.status)}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="print-only" ref={printRef}>
        {selectedOrders.map((order, idx) => {
          const detail = orderDetails[order.id] || order;
          const items = detail.items || [];
          const isMomo = order.payment_method === 'momo';
          const isCOD = order.notes && order.notes.toLowerCase().includes('paid on delivery');
          const isCash = order.payment_method === 'cash' && !isCOD;
          // Extract momo ref from notes
          const momoRefMatch = (order.notes || '').match(/MoMo Ref:\s*(\S+)/);
          const momoRef = momoRefMatch ? momoRefMatch[1] : null;

          return (
            <div key={order.id} className="receipt-print-page">
              {/* Header */}
              <div className="receipt-print-header">
                <div className="receipt-brand">
                  <div className="receipt-logo">SW</div>
                  <div>
                    <div className="receipt-brand-name">Shore Winds</div>
                    <div className="receipt-brand-sub">Official Receipt</div>
                  </div>
                </div>
                <div className="receipt-meta">
                  <div className="receipt-order-num">{order.order_number}</div>
                  <div className="receipt-date">{formatDate(order.created_at)}</div>
                </div>
              </div>

              <div className="receipt-divider"/>

              {/* Info Grid */}
              <div className="receipt-info-grid">
                <div className="receipt-info-block">
                  <div className="receipt-info-label">Customer</div>
                  <div className="receipt-info-value">{order.customer_name || '-'}</div>
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
                  <div className="receipt-info-value">
                    {isMomo ? 'MTN MoMo' : isCOD ? 'Cash on Delivery' : 'Cash'}
                  </div>
                  {isMomo && momoRef && (
                    <div className="receipt-momo-ref">
                      <span className="receipt-info-label">Ref: </span>
                      <strong>{momoRef}</strong>
                    </div>
                  )}
                  {isCOD && (
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
                  <div className="receipt-info-value receipt-status">{order.status ? order.status.toUpperCase() : '-'}</div>
                  {order.notes && (
                    <div className="receipt-info-sub" style={{ fontStyle: 'italic' }}>{order.notes}</div>
                  )}
                </div>
              </div>

              <div className="receipt-divider"/>

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
                        <td className="text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '0.5rem 0' }}>No items found</div>
              )}

              <div className="receipt-divider"/>

              {/* Totals */}
              <div className="receipt-totals">
                {order.delivery_fee > 0 && (
                  <div className="receipt-total-row">
                    <span>Delivery Fee</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="receipt-total-row">
                    <span>Discount</span>
                    <span>- {formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="receipt-total-row receipt-grand-total">
                  <span>{isCOD ? 'Amount Due on Delivery' : 'Total Paid'}</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              {/* MoMo notice */}
              {isMomo && (
                <>
                  <div className="receipt-divider"/>
                  <div style={{ fontSize: '0.78rem', color: '#475569', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                    <strong>MTN MoMo Payment</strong> — Funds sent to <strong>Shore Winds</strong>. Reference: <strong>{momoRef || 'N/A'}</strong>
                  </div>
                </>
              )}

              <div className="receipt-divider"/>

              {/* Footer + QR */}
              <div className="receipt-print-footer">
                <div className="receipt-qr">
                  <QRCodeSVG
                    value={JSON.stringify({
                      order: order.order_number,
                      customer: order.customer_name,
                      amount: order.total_amount,
                      payment: isMomo ? 'MTN MoMo' : isCOD ? 'Cash on Delivery' : 'Cash',
                      ref: momoRef || null,
                      date: order.created_at,
                    })}
                    size={90}
                    level="M"
                  />
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem' }}>Scan to verify order</div>
                </div>
                <p>Thank you for shopping with us!</p>
                <p>Shore Winds — Powered by ProCyclone</p>
              </div>

              {idx < selectedOrders.length - 1 && <div className="receipt-page-break"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Receipts;
