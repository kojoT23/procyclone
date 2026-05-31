import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '../utils/api';

const STATUS_COLORS = {
  pending:          { bg: '#fff3cd', text: '#856404' },
  confirmed:        { bg: '#cce5ff', text: '#004085' },
  packing:          { bg: '#d4edda', text: '#155724' },
  assigned:         { bg: '#e2d9f3', text: '#4a235a' },
  out_for_delivery: { bg: '#ffd6a5', text: '#7d4e00' },
  delivered:        { bg: '#d4edda', text: '#155724' },
  failed:           { bg: '#f8d7da', text: '#721c24' },
  returned:         { bg: '#e2e3e5', text: '#383d41' },
};

const STATUSES = ['pending','confirmed','packing','assigned','out_for_delivery','delivered','failed','returned'];

const Badge = ({ value, map }) => {
  const c = map[value] || { bg: '#eee', text: '#333' };
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: '600', textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {value?.replace(/_/g, ' ')}
    </span>
  );
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterPayment) params.payment_method = filterPayment;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterPayment]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPayment]);

  const updateStatus = async (orderId, status) => {
    try {
      setUpdating(orderId);
      await ordersAPI.updateStatus(orderId, { status });
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const sendWhatsApp = (order) => {
    const msg = `Hi ${order.customer_name || 'Customer'}, your ProCyclone order ${order.order_number} is now *${order.status?.replace(/_/g, ' ')}*. Total: GH₵ ${parseFloat(order.total_amount).toFixed(2)}. Thank you!`;
    const phone = order.customer_phone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>{total} total orders</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="🔍 Search by order #, customer name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '130px' }}
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
          >
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="momo">MoMo</option>
          </select>
          {(search || filterStatus || filterPayment) && (
            <button
              className="btn btn-secondary"
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPayment(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>
                        <span
                          style={{ fontWeight: '600', color: '#1a1a2e', cursor: 'pointer' }}
                          onClick={() => setSelectedOrder(order)}
                        >
                          {order.order_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{order.customer_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{order.customer_phone}</div>
                      </td>
                      <td><Badge value={order.status} map={STATUS_COLORS} /></td>
                      <td>
                        <span style={{
                          background: order.payment_method === 'momo' ? '#cce5ff' : '#fff3cd',
                          color: order.payment_method === 'momo' ? '#004085' : '#856404',
                          padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                        }}>
                          {order.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>GH₵ {parseFloat(order.total_amount || 0).toFixed(2)}</td>
                      <td style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <select
                            className="form-input"
                            style={{ width: 'auto', fontSize: '12px', padding: '4px 8px' }}
                            value={order.status}
                            disabled={updating === order.id}
                            onChange={e => updateStatus(order.id, e.target.value)}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-success"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => sendWhatsApp(order)}
                            title="Send WhatsApp update"
                          >
                            💬
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {pages}</span>
                <button className="btn btn-secondary" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedOrder.order_number}</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Customer</p>
                  <p style={{ fontWeight: '600', margin: 0 }}>{selectedOrder.customer_name || '—'}</p>
                  <p style={{ color: '#888', fontSize: '12px', margin: '2px 0 0' }}>{selectedOrder.customer_phone}</p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Status</p>
                  <Badge value={selectedOrder.status} map={STATUS_COLORS} />
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Payment</p>
                  <p style={{ fontWeight: '600', margin: 0 }}>{selectedOrder.payment_method?.toUpperCase()}</p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Total</p>
                  <p style={{ fontWeight: '700', fontSize: '18px', color: '#2ecc71', margin: 0 }}>GH₵ {parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</p>
                </div>
              </div>
              {selectedOrder.delivery_address && (
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Delivery Address</p>
                  <p style={{ margin: 0 }}>{selectedOrder.delivery_address}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <select
                  className="form-input"
                  value={selectedOrder.status}
                  onChange={e => updateStatus(selectedOrder.id, e.target.value)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <button className="btn btn-success" onClick={() => sendWhatsApp(selectedOrder)}>
                  💬 WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
