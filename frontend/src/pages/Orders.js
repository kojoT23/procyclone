import React, { useState, useEffect, useCallback } from 'react';
import { ordersAPI, customersAPI, productsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ─── Constants ───────────────────────────────────────────────── */
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

const STATUSES = [
  'pending', 'confirmed', 'packing', 'assigned',
  'out_for_delivery', 'delivered', 'failed', 'returned',
];

/* ─── Payment badge ───────────────────────────────────────────── */
const PaymentBadge = ({ method }) => {
  const cls =
    method === 'momo' ? 'badge badge-blue'  :
    method === 'cod'  ? 'badge badge-amber' :
    method === 'cash' ? 'badge badge-green' : 'badge badge-gray';
  const label =
    method === 'momo' ? 'MTN MoMo' :
    method === 'cod'  ? 'Cash on Delivery' :
    method === 'cash' ? 'Cash' :
    method?.toUpperCase() || '—';
  return <span className={cls}>{label}</span>;
};

/* ─── Status badge ────────────────────────────────────────────── */
const StatusBadge = ({ status }) => (
  <span
    className="badge"
    style={{
      background: STATUS_COLORS[status]?.bg || '#f1f5f9',
      color:      STATUS_COLORS[status]?.text || '#475569',
    }}
  >
    {status?.replace(/_/g, ' ')}
  </span>
);

/* ─── WhatsApp icon ───────────────────────────────────────────── */
const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Orders = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  /* List state */
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);

  /* Filters */
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDate,    setFilterDate]    = useState('');

  /* Actions */
  const [updating,      setUpdating]      = useState(null);
  const [deleting,      setDeleting]      = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems,    setOrderItems]    = useState([]);
  const [loadingItems,  setLoadingItems]  = useState(false);

  /* Create order */
  const [showCreate,      setShowCreate]      = useState(false);
  const [customers,       setCustomers]       = useState([]);
  const [products,        setProducts]        = useState([]);
  const [saving,          setSaving]          = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQty,     setSelectedQty]     = useState(1);
  const [orderForm,       setOrderForm]       = useState({
    customer_id: '', payment_method: 'momo',
    momo_reference: '', delivery_address: '', notes: '', items: [],
  });

  /* ── Fetch orders ────────────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search)        params.search         = search;
      if (filterStatus)  params.status         = filterStatus;
      if (filterPayment) params.payment_method = filterPayment;
      if (filterDate)    params.date           = filterDate;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data.orders || []);
      setTotal(res.data.total   || 0);
      setPages(res.data.pages   || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterPayment, filterDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPayment, filterDate]);

  /* ── Open order detail — fetch items ─────────────────────────── */
  const openDetail = async (order) => {
    setSelectedOrder(order);
    setOrderItems([]);
    try {
      setLoadingItems(true);
      const res = await ordersAPI.getOne(order.id);
      setOrderItems(res.data.order?.items || []);
    } catch {
      setOrderItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  /* ── Open create modal ────────────────────────────────────────── */
  const openCreate = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        customersAPI.getAll({ limit: 100 }),
        productsAPI.getAll({ limit: 100 }),
      ]);
      setCustomers(custRes.data.customers || []);
      setProducts(prodRes.data.products?.filter(p => p.stock_quantity > 0) || []);
      setOrderForm({ customer_id: '', payment_method: 'momo', momo_reference: '', delivery_address: '', notes: '', items: [] });
      setSelectedProduct('');
      setSelectedQty(1);
      setShowCreate(true);
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Add / remove / update items ─────────────────────────────── */
  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (!product) return;
    const existing = orderForm.items.find(i => i.product_id === product.id);
    if (existing) {
      setOrderForm(f => ({
        ...f,
        items: f.items.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + selectedQty } : i
        ),
      }));
    } else {
      setOrderForm(f => ({
        ...f,
        items: [...f.items, {
          product_id: product.id,
          name:       product.name,
          quantity:   selectedQty,
          unit_price: parseFloat(product.price),
        }],
      }));
    }
    setSelectedProduct('');
    setSelectedQty(1);
  };

  const removeItem    = (pid) => setOrderForm(f => ({ ...f, items: f.items.filter(i => i.product_id !== pid) }));
  const updateItemQty = (pid, qty) => qty < 1 ? removeItem(pid) : setOrderForm(f => ({
    ...f, items: f.items.map(i => i.product_id === pid ? { ...i, quantity: qty } : i),
  }));

  const orderTotal = orderForm.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  /* ── Create order ─────────────────────────────────────────────── */
  const handleCreateOrder = async () => {
    if (!orderForm.customer_id)     return alert('Please select a customer');
    if (!orderForm.items.length)    return alert('Please add at least one product');
    if (!orderForm.delivery_address) return alert('Please enter a delivery address');
    try {
      setSaving(true);
      await ordersAPI.create({
        customer_id:      parseInt(orderForm.customer_id),
        payment_method:   orderForm.payment_method === 'cod' ? 'cod' : orderForm.payment_method,
        momo_reference:   orderForm.payment_method === 'momo' ? orderForm.momo_reference : undefined,
        delivery_address: orderForm.delivery_address,
        notes:            orderForm.notes,
        items: orderForm.items.map(i => ({
          product_id: i.product_id,
          quantity:   i.quantity,
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

  /* ── Update status ────────────────────────────────────────────── */
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

  /* ── Delete order ─────────────────────────────────────────────── */
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

  /* ── WhatsApp notification ────────────────────────────────────── */
  const sendWhatsApp = (order) => {
    const msg = `Hi ${order.customer_name || 'Customer'}, your ProCyclone order ${order.order_number} is now *${order.status?.replace(/_/g, ' ')}*. Total: GH₵ ${parseFloat(order.total_amount).toFixed(2)}. Thank you!`;
    const phone = order.customer_phone?.replace(/\D/g, '');
    const intlPhone = phone?.startsWith('0') ? '233' + phone.slice(1) : phone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* ── Derived counts ───────────────────────────────────────────── */
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">
            {total} total orders
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Order</button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <strong>⏳ {pendingCount} order{pendingCount > 1 ? 's are' : ' is'} pending.</strong>
          {' '}Confirm or assign them to a rider.
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="🔍 Search by order #, customer name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
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
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '150px' }}
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
          >
            <option value="">All payments</option>
            <option value="momo">MTN MoMo</option>
            <option value="cod">Cash on Delivery</option>
            <option value="cash">Cash</option>
          </select>
          {(search || filterStatus || filterPayment || filterDate) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPayment(''); setFilterDate(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h3>No orders found</h3>
            <p>{search || filterStatus || filterPayment || filterDate ? 'No orders match your filters.' : 'Create your first order.'}</p>
            {!search && !filterStatus && !filterPayment && !filterDate && (
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openCreate}>+ New Order</button>
            )}
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
                    <tr
                      key={order.id}
                      style={order.status === 'pending' ? { borderLeft: '3px solid #f59e0b' } : {}}
                    >
                      <td>
                        <span
                          style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '600', color: 'var(--navy)', cursor: 'pointer', textDecoration: 'underline dotted' }}
                          onClick={() => openDetail(order)}
                        >
                          {order.order_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{order.customer_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{order.customer_phone}</div>
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td><PaymentBadge method={order.payment_method} /></td>
                      <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                        GH₵ {parseFloat(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            className="form-input"
                            style={{ width: 'auto', fontSize: '12px', padding: '5px 28px 5px 8px', minWidth: '130px' }}
                            value={order.status}
                            disabled={updating === order.id}
                            onChange={e => updateStatus(order.id, e.target.value)}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button
                            className="btn btn-success btn-sm"
                            style={{ padding: '6px 10px' }}
                            onClick={() => sendWhatsApp(order)}
                            title="Send WhatsApp update"
                          >
                            <WhatsAppIcon />
                          </button>
                          {isSuperAdmin && (
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '6px 10px' }}
                              onClick={() => handleDelete(order)}
                              disabled={deleting === order.id}
                              title="Delete order"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">Page {page} of {pages} · {total} orders</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Order Detail Modal
      ══════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontFamily: 'monospace', fontSize: '16px' }}>
                {selectedOrder.order_number}
              </h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>

            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Customer', value: selectedOrder.customer_name, sub: selectedOrder.customer_phone },
                { label: 'Total',    value: `GH₵ ${parseFloat(selectedOrder.total_amount || 0).toFixed(2)}`, accent: true },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
                  <p style={{ fontWeight: accent ? '800' : '600', fontSize: accent ? '20px' : '14px', color: accent ? 'var(--accent, #22c55e)' : 'inherit', margin: 0 }}>{value}</p>
                  {sub && <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '2px 0 0' }}>{sub}</p>}
                </div>
              ))}
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 6px' }}>Status</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 6px' }}>Payment</p>
                <PaymentBadge method={selectedOrder.payment_method} />
              </div>
            </div>

            {/* Delivery address */}
            {selectedOrder.delivery_address && (
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>Delivery Address</p>
                <p style={{ margin: 0, fontSize: '13px' }}>{selectedOrder.delivery_address}</p>
              </div>
            )}

            {/* Notes */}
            {selectedOrder.notes && (
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 4px' }}>Notes</p>
                <p style={{ margin: 0, fontSize: '13px' }}>{selectedOrder.notes}</p>
              </div>
            )}

            {/* Order items */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Items</p>
              {loadingItems ? (
                <div className="loading" style={{ padding: '12px 0' }}>
                  <div className="loading-spinner" />
                  <span className="loading-text">Loading items…</span>
                </div>
              ) : orderItems.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>No items on record</p>
              ) : (
                <div style={{ background: 'var(--bg)', borderRadius: '8px', overflow: 'hidden' }}>
                  {orderItems.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px',
                        borderBottom: i < orderItems.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{item.product_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {item.quantity} × GH₵ {parseFloat(item.unit_price || 0).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                        GH₵ {(item.quantity * parseFloat(item.unit_price || 0)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 14px', fontWeight: '800', fontSize: '15px',
                    borderTop: '2px solid var(--border)',
                  }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--accent, #22c55e)' }}>
                      GH₵ {parseFloat(selectedOrder.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-input"
                style={{ flex: 1 }}
                value={selectedOrder.status}
                disabled={updating === selectedOrder.id}
                onChange={e => updateStatus(selectedOrder.id, e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              <button className="btn btn-success" onClick={() => sendWhatsApp(selectedOrder)}>
                <WhatsAppIcon /> WhatsApp
              </button>
              {isSuperAdmin && (
                <button className="btn btn-danger" onClick={() => handleDelete(selectedOrder)}>🗑</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Create Order Modal
      ══════════════════════════════════════════════════════════ */}
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
              <select
                className="form-input"
                value={orderForm.customer_id}
                onChange={e => {
                  const customer = customers.find(c => c.id === parseInt(e.target.value));
                  setOrderForm(f => ({
                    ...f,
                    customer_id:      e.target.value,
                    delivery_address: customer?.address || f.delivery_address,
                  }));
                }}
              >
                <option value="">Select customer…</option>
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
                  <option value="">Select product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — GH₵ {parseFloat(p.price).toFixed(2)} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
                <input
                  className="form-input"
                  type="number" min="1"
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
                  <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
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
                    <span style={{ fontWeight: '700', color: 'var(--accent, #22c55e)', minWidth: '80px', textAlign: 'right' }}>
                      GH₵ {(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px' }}
                      onClick={() => removeItem(item.product_id)}
                    >✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontWeight: '800', fontSize: '15px' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent, #22c55e)' }}>GH₵ {orderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Payment method */}
            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-input"
                value={orderForm.payment_method}
                onChange={e => setOrderForm(f => ({ ...f, payment_method: e.target.value, momo_reference: '' }))}
              >
                <option value="momo">MTN MoMo</option>
                <option value="cod">Cash on Delivery</option>
                <option value="cash">Cash (Paid)</option>
              </select>
            </div>

            {/* MoMo reference — only show when momo selected */}
            {orderForm.payment_method === 'momo' && (
              <div className="form-group">
                <label className="form-label">
                  MoMo Reference
                  <span style={{ color: 'var(--text-3)', fontWeight: '400', marginLeft: '4px' }}>(recommended)</span>
                </label>
                <input
                  className="form-input"
                  value={orderForm.momo_reference}
                  onChange={e => setOrderForm(f => ({ ...f, momo_reference: e.target.value }))}
                  placeholder="e.g. MP240601123456"
                  style={{ fontFamily: 'monospace' }}
                />
                <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '4px 0 0' }}>
                  Found in the MoMo confirmation SMS
                </p>
              </div>
            )}

            {/* COD info */}
            {orderForm.payment_method === 'cod' && (
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                💵 Rider will collect cash at the door. You can confirm and generate a receipt from the Payments page after delivery.
              </div>
            )}

            {/* Delivery address */}
            <div className="form-group">
              <label className="form-label">Delivery Address *</label>
              <input
                className="form-input"
                value={orderForm.delivery_address}
                onChange={e => setOrderForm(f => ({ ...f, delivery_address: e.target.value }))}
                placeholder="e.g. Accra, East Legon"
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={orderForm.notes}
                onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any special instructions…"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateOrder} disabled={saving}>
                {saving ? 'Creating…' : `Create Order — GH₵ ${orderTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
