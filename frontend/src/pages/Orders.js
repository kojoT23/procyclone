import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, customersAPI, productsAPI } from '../utils/api';

const STATUS_COLORS = {
  pending:          { bg: '#fef3c7', text: '#d97706' },
  confirmed:        { bg: '#dbeafe', text: '#1d4ed8' },
  packing:          { bg: '#ede9fe', text: '#7c3aed' },
  assigned:         { bg: '#ccfbf1', text: '#0f766e' },
  out_for_delivery: { bg: '#fed7aa', text: '#c2410c' },
  delivered:        { bg: '#dcfce7', text: '#16a34a' },
  failed:           { bg: '#fee2e2', text: '#dc2626' },
  returned:         { bg: '#f1f5f9', text: '#475569' },
};

const STATUSES = ['pending','confirmed','packing','assigned','out_for_delivery','delivered','failed','returned'];

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

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
  const [deleting, setDeleting] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Create order state
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    payment_method: 'cash',
    delivery_address: '',
    notes: '',
    items: [],
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

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
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPayment]);

  const openCreate = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        customersAPI.getAll({ limit: 100 }),
        productsAPI.getAll({ limit: 100 }),
      ]);
      setCustomers(custRes.data.customers || []);
      setProducts(prodRes.data.products?.filter(p => p.stock_quantity > 0) || []);
      setOrderForm({ customer_id: '', payment_method: 'cash', delivery_address: '', notes: '', items: [] });
      setSelectedProduct('');
      setSelectedQty(1);
      setShowCreate(true);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (!product) return;

    const existing = orderForm.items.find(i => i.product_id === product.id);
    if (existing) {
      setOrderForm(f => ({
        ...f,
        items: f.items.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + selectedQty }
          : i
        ),
      }));
    } else {
      setOrderForm(f => ({
        ...f,
        items: [...f.items, {
          product_id: product.id,
          name: product.name,
          quantity: selectedQty,
          unit_price: parseFloat(product.price),
        }],
      }));
    }
    setSelectedProduct('');
    setSelectedQty(1);
  };

  const removeItem = (product_id) => {
    setOrderForm(f => ({ ...f, items: f.items.filter(i => i.product_id !== product_id) }));
  };

  const updateItemQty = (product_id, qty) => {
    if (qty < 1) return removeItem(product_id);
    setOrderForm(f => ({
      ...f,
      items: f.items.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i),
    }));
  };

  const orderTotal = orderForm.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleCreateOrder = async () => {
    if (!orderForm.customer_id) return alert('Please select a customer');
    if (orderForm.items.length === 0) return alert('Please add at least one product');
    if (!orderForm.delivery_address) return alert('Please enter a delivery address');

    try {
      setSaving(true);
      await ordersAPI.create({
        customer_id: parseInt(orderForm.customer_id),
        payment_method: orderForm.payment_method,
        delivery_address: orderForm.delivery_address,
        notes: orderForm.notes,
        items: orderForm.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      setShowCreate(false);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating order');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      setUpdating(orderId);
      await ordersAPI.updateStatus(orderId, { status });
      fetchOrders();
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => ({ ...prev, status }));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete order ${order.order_number}? This cannot be undone.`)) return;
    try {
      setDeleting(order.id);
      await ordersAPI.delete(order.id);
      fetchOrders();
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting order');
    } finally {
      setDeleting(null);
    }
  };

  const sendWhatsApp = (order) => {
    const msg = `Hi ${order.customer_name || 'Customer'}, your ProCyclone order ${order.order_number} is now *${order.status?.replace(/_/g, ' ')}*. Total: GH₵ ${parseFloat(order.total_amount).toFixed(2)}. Thank you!`;
    const phone = order.customer_phone?.replace(/\D/g, '');
    const intlPhone = phone?.startsWith('0') ? '233' + phone.slice(1) : phone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{total} total orders</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Order</button>
      </div>

      {/* Search + filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="Search by order #, customer name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-input" style={{ width: 'auto', minWidth: '140px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', minWidth: '130px' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="momo">MoMo</option>
          </select>
          {(search || filterStatus || filterPayment) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterPayment(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <p className="loading-text">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h3>No orders found</h3>
            <p>Create your first order or adjust your filters</p>
            <button className="btn btn-primary" style={{ marginTop: '4px' }} onClick={openCreate}>+ New Order</button>
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
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: 'var(--navy)', cursor: 'pointer' }}
                          onClick={() => setSelectedOrder(order)}
                        >
                          {order.order_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{order.customer_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{order.customer_phone}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: STATUS_COLORS[order.status]?.bg, color: STATUS_COLORS[order.status]?.text }}>
                          {order.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: order.payment_method === 'momo' ? '#dbeafe' : '#fef3c7',
                          color: order.payment_method === 'momo' ? '#1d4ed8' : '#d97706',
                        }}>
                          {order.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700', color: 'var(--accent-dim)' }}>
                        GH₵ {parseFloat(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            className="form-input"
                            style={{ width: 'auto', fontSize: '12px', padding: '5px 28px 5px 8px', minWidth: '110px' }}
                            value={order.status}
                            disabled={updating === order.id}
                            onChange={e => updateStatus(order.id, e.target.value)}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button className="btn btn-success btn-sm" style={{ padding: '6px 10px' }} onClick={() => sendWhatsApp(order)}>
                            <WhatsAppIcon />
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }} onClick={() => handleDelete(order)} disabled={deleting === order.id}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="pagination-info">Page {page} of {pages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
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
              <h2 className="modal-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '16px' }}>{selectedOrder.order_number}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>Customer</p>
                <p style={{ fontWeight: '600', margin: 0 }}>{selectedOrder.customer_name || '—'}</p>
                <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '2px 0 0' }}>{selectedOrder.customer_phone}</p>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>Total</p>
                <p style={{ fontWeight: '700', fontSize: '22px', color: 'var(--accent-dim)', margin: 0 }}>GH₵ {parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</p>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 6px' }}>Status</p>
                <span className="badge" style={{ background: STATUS_COLORS[selectedOrder.status]?.bg, color: STATUS_COLORS[selectedOrder.status]?.text }}>
                  {selectedOrder.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 6px' }}>Payment</p>
                <span className="badge" style={{
                  background: selectedOrder.payment_method === 'momo' ? '#dbeafe' : '#fef3c7',
                  color: selectedOrder.payment_method === 'momo' ? '#1d4ed8' : '#d97706',
                }}>
                  {selectedOrder.payment_method?.toUpperCase()}
                </span>
              </div>
            </div>
            {selectedOrder.delivery_address && (
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>Delivery Address</p>
                <p style={{ margin: 0, fontSize: '13px' }}>{selectedOrder.delivery_address}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select className="form-input" style={{ flex: 1 }} value={selectedOrder.status} onChange={e => updateStatus(selectedOrder.id, e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              <button className="btn btn-success" onClick={() => sendWhatsApp(selectedOrder)} style={{ gap: '6px' }}>
                <WhatsAppIcon /> WhatsApp
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(selectedOrder)}>🗑</button>
            </div>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {/* Customer */}
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select className="form-input" value={orderForm.customer_id} onChange={e => {
                const customer = customers.find(c => c.id === parseInt(e.target.value));
                setOrderForm(f => ({
                  ...f,
                  customer_id: e.target.value,
                  delivery_address: customer?.address || f.delivery_address,
                }));
              }}>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </div>

            {/* Add products */}
            <div className="form-group">
              <label className="form-label">Add Products *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="form-input"
                  style={{ flex: 1 }}
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — GH₵ {parseFloat(p.price).toFixed(2)} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={e => setSelectedQty(parseInt(e.target.value) || 1)}
                  style={{ width: '70px' }}
                />
                <button className="btn btn-primary" onClick={addItem}>Add</button>
              </div>
            </div>

            {/* Items list */}
            {orderForm.items.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                {orderForm.items.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
                    <span style={{ flex: 1, fontWeight: '500', fontSize: '13px' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}
                        onClick={() => updateItemQty(item.product_id, item.quantity - 1)}
                      >−</button>
                      <span style={{ fontWeight: '700', minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}
                        onClick={() => updateItemQty(item.product_id, item.quantity + 1)}
                      >+</button>
                    </div>
                    <span style={{ fontWeight: '700', color: 'var(--accent-dim)', minWidth: '80px', textAlign: 'right' }}>
                      GH₵ {(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px' }}
                      onClick={() => removeItem(item.product_id)}
                    >✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontWeight: '700', fontSize: '15px' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent-dim)' }}>GH₵ {orderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Payment + address */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select className="form-input" value={orderForm.payment_method} onChange={e => setOrderForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="momo">MoMo</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Address *</label>
                <input className="form-input" value={orderForm.delivery_address} onChange={e => setOrderForm(f => ({ ...f, delivery_address: e.target.value }))} placeholder="e.g. Accra, East Legon" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateOrder} disabled={saving}>
                {saving ? 'Creating...' : `Create Order — GH₵ ${orderTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
