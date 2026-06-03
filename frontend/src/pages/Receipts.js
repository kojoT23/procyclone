import React, { useState, useEffect, useRef } from 'react';
import { ordersAPI } from '../utils/api';
import './Receipts.css';

const Receipts = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const printRef = useRef();

  useEffect(() => {
    fetchOrders();
  }, []);

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

  const handlePrint = () => {
    if (selected.length === 0) {
      alert('Please select at least one order to print.');
      return;
    }
    window.print();
  };

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
        {selectedOrders.map((order, idx) => (
          <div key={order.id} className="receipt-print-page">
            <div className="receipt-print-header">
              <div className="receipt-brand">
                <div className="receipt-logo">PC</div>
                <div>
                  <div className="receipt-brand-name">ProCyclone</div>
                  <div className="receipt-brand-sub">Order Receipt</div>
                </div>
              </div>
              <div className="receipt-meta">
                <div className="receipt-order-num">{order.order_number}</div>
                <div className="receipt-date">{formatDate(order.created_at)}</div>
              </div>
            </div>

            <div className="receipt-divider"/>

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
                <div className="receipt-info-label">Payment Method</div>
                <div className="receipt-info-value">
                  {order.payment_method ? order.payment_method.toUpperCase() : '-'}
                </div>
                {order.payment_method === 'momo' && order.momo_reference && (
                  <div className="receipt-momo-ref">
                    <span className="receipt-info-label">MoMo Ref: </span>
                    <strong>{order.momo_reference}</strong>
                  </div>
                )}
              </div>
              <div className="receipt-info-block">
                <div className="receipt-info-label">Status</div>
                <div className="receipt-info-value receipt-status">
                  {order.status ? order.status.toUpperCase() : '-'}
                </div>
              </div>
            </div>

            <div className="receipt-divider"/>

            {order.items && order.items.length > 0 && (
              <>
                <div className="receipt-section-title">Items Ordered</div>
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
                    {order.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.product_name}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="receipt-divider"/>
              </>
            )}

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
                <span>Total Paid</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            <div className="receipt-divider"/>

            <div className="receipt-print-footer">
              <p>Thank you for your order!</p>
              <p>ProCyclone — Ghana's Smart Commerce Platform</p>
            </div>

            {idx < selectedOrders.length - 1 && <div className="receipt-page-break"/>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Receipts;
