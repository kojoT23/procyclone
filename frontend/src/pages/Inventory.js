import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

/* ─── API ─────────────────────────────────────────────────────── */
const inventoryAPI = {
  getMovements:        (params) => API.get('/inventory/movements', { params }),
  adjustStock:         (data)   => API.post('/inventory/movements/adjust', data),
  getSuppliers:        (params) => API.get('/inventory/suppliers', { params }),
  createSupplier:      (data)   => API.post('/inventory/suppliers', data),
  updateSupplier:      (id, data) => API.put(`/inventory/suppliers/${id}`, data),
  getPurchaseOrders:   (params) => API.get('/inventory/purchase-orders', { params }),
  createPurchaseOrder: (data)   => API.post('/inventory/purchase-orders', data),
  receivePurchaseOrder:(id, data)=> API.post(`/inventory/purchase-orders/${id}/receive`, data),
};

const productsAPI_local = { getAll: (params) => API.get('/products', { params }) };

/* ─── Movement type badge ─────────────────────────────────────── */
const MovementBadge = ({ type }) => {
  const cls =
    type === 'purchase'   ? 'badge badge-green'  :
    type === 'sale'       ? 'badge badge-blue'   :
    type === 'return'     ? 'badge badge-purple' :
    type === 'adjustment' ? 'badge badge-amber'  :
    type === 'damage'     ? 'badge badge-red'    : 'badge badge-gray';
  return <span className={cls}>{type}</span>;
};

/* ─── PO status badge ─────────────────────────────────────────── */
const POBadge = ({ status }) => {
  const cls =
    status === 'received'  ? 'badge badge-green'  :
    status === 'partial'   ? 'badge badge-blue'   :
    status === 'cancelled' ? 'badge badge-red'    : 'badge badge-amber';
  return <span className={cls}>{status}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   TAB: Stock Movements
═══════════════════════════════════════════════════════════════ */
const MovementsTab = () => {
  const [movements,  setMovements]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [products,   setProducts]   = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ product_id: '', type: 'adjustment', quantity: '', notes: '' });
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [movRes, prodRes] = await Promise.all([
        inventoryAPI.getMovements({ limit: PAGE_SIZE, page }),
        productsAPI_local.getAll({ limit: 100 }),
      ]);
      setMovements(movRes.data.movements || []);
      setTotal(movRes.data.total || 0);
      setTotalPages(Math.max(1, Math.ceil((movRes.data.total || 0) / PAGE_SIZE)));
      setProducts(prodRes.data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdjust = async () => {
    if (!form.product_id || !form.quantity) return alert('Product and quantity are required');
    try {
      setSaving(true);
      await inventoryAPI.adjustStock(form);
      setShowModal(false);
      setForm({ product_id: '', type: 'adjustment', quantity: '', notes: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error adjusting stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span className="pagination-info">{total} movements</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Adjust Stock</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading movements…</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No stock movements yet</h3>
            <p>Stock changes will appear here automatically</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Notes</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: '600' }}>{m.product_name}</td>
                      <td><MovementBadge type={m.type} /></td>
                      <td style={{
                        fontWeight: '700', fontSize: '15px',
                        color: m.quantity > 0 ? 'var(--accent, #22c55e)' : '#ef4444',
                      }}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{m.notes || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '16px' }}>
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Adjust Stock</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select className="form-input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">Select product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="adjustment">Adjustment</option>
                  <option value="return">Return</option>
                  <option value="damage">Damage</option>
                  <option value="transfer">Transfer</option>
                  <option value="purchase">Purchase</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Use negative for removals" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment…" />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdjust} disabled={saving}>
                {saving ? 'Saving…' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TAB: Suppliers
═══════════════════════════════════════════════════════════════ */
const SuppliersTab = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryAPI.getSuppliers({ limit: 100 });
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert('Supplier name is required');
    try {
      setSaving(true);
      editing
        ? await inventoryAPI.updateSupplier(editing.id, form)
        : await inventoryAPI.createSupplier(form);
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading suppliers…</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏭</div>
            <h3>No suppliers yet</h3>
            <p>Add suppliers to use them in purchase orders</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Supplier</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{s.phone || '—'}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{s.email || '—'}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{s.address || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>{s.notes || '—'}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Accra Bike Parts Ltd" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0244123456" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Accra, Ghana" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this supplier…" />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TAB: Purchase Orders
═══════════════════════════════════════════════════════════════ */
const PurchaseOrdersTab = () => {
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [form,      setForm]      = useState({
    supplier_id: '', expected_date: '', notes: '', items: [],
  });
  const [selProduct, setSelProduct] = useState('');
  const [selQty,     setSelQty]     = useState(1);
  const [selCost,    setSelCost]    = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const [ordRes, supRes, prodRes] = await Promise.all([
        inventoryAPI.getPurchaseOrders({ limit: 50 }),
        inventoryAPI.getSuppliers({ limit: 100 }),
        productsAPI_local.getAll({ limit: 100 }),
      ]);
      setOrders(ordRes.data.purchase_orders || []);
      setSuppliers(supRes.data.suppliers || []);
      setProducts(prodRes.data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* Add item to PO */
  const addItem = () => {
    if (!selProduct || !selQty || !selCost) return alert('Select product, quantity and cost price');
    const product = products.find(p => p.id === parseInt(selProduct));
    if (!product) return;
    const existing = form.items.find(i => i.product_id === product.id);
    if (existing) {
      setForm(f => ({ ...f, items: f.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + selQty, cost_price: parseFloat(selCost) } : i) }));
    } else {
      setForm(f => ({ ...f, items: [...f.items, { product_id: product.id, name: product.name, quantity: selQty, cost_price: parseFloat(selCost) }] }));
    }
    setSelProduct(''); setSelQty(1); setSelCost('');
  };

  const removeItem = (pid) => setForm(f => ({ ...f, items: f.items.filter(i => i.product_id !== pid) }));

  const poTotal = form.items.reduce((s, i) => s + i.cost_price * i.quantity, 0);

  /* Create PO */
  const handleCreate = async () => {
    if (!form.supplier_id)      return alert('Please select a supplier');
    if (!form.items.length)     return alert('Please add at least one product');
    try {
      setSaving(true);
      await inventoryAPI.createPurchaseOrder({
        supplier_id:   parseInt(form.supplier_id),
        expected_date: form.expected_date || null,
        notes:         form.notes,
        items:         form.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, cost_price: i.cost_price })),
      });
      setShowModal(false);
      setForm({ supplier_id: '', expected_date: '', notes: '', items: [] });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating purchase order');
    } finally {
      setSaving(false);
    }
  };

  /* Mark received */
  const handleReceive = async (po) => {
    if (!window.confirm(`Mark PO ${po.reference} as received? This will update stock levels.`)) return;
    try {
      setReceiving(po.id);
      await inventoryAPI.receivePurchaseOrder(po.id, {});
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error receiving purchase order');
    } finally {
      setReceiving(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span className="pagination-info">{orders.length} purchase orders</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Purchase Order</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading purchase orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No purchase orders yet</h3>
            <p>Create a purchase order to restock from a supplier</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>+ New Purchase Order</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Expected</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(po => (
                  <tr key={po.id}>
                    <td style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>{po.reference}</td>
                    <td style={{ fontWeight: '500' }}>{po.supplier_name || '—'}</td>
                    <td><POBadge status={po.status} /></td>
                    <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                      GH₵ {parseFloat(po.total_amount || 0).toFixed(2)}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                      {po.expected_date
                        ? new Date(po.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(po.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {po.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleReceive(po)}
                          disabled={receiving === po.id}
                        >
                          {receiving === po.id ? 'Receiving…' : '✓ Mark Received'}
                        </button>
                      )}
                      {po.status !== 'pending' && (
                        <span className="badge badge-green">✓ Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create PO Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Supplier *</label>
                <select className="form-input" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected Delivery</label>
                <input className="form-input" type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
              </div>
            </div>

            {/* Add products */}
            <div className="form-group">
              <label className="form-label">Add Products *</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select className="form-input" style={{ flex: 2, minWidth: '160px' }} value={selProduct} onChange={e => setSelProduct(e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
                </select>
                <input className="form-input" type="number" min="1" value={selQty} onChange={e => setSelQty(parseInt(e.target.value) || 1)} style={{ width: '65px' }} placeholder="Qty" />
                <input className="form-input" type="number" min="0" step="0.01" value={selCost} onChange={e => setSelCost(e.target.value)} style={{ width: '90px' }} placeholder="Cost (GH₵)" />
                <button className="btn btn-primary" onClick={addItem}>Add</button>
              </div>
            </div>

            {/* Items list */}
            {form.items.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                {form.items.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ flex: 1, fontWeight: '500', fontSize: '13px' }}>{item.name}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{item.quantity} × GH₵ {item.cost_price.toFixed(2)}</span>
                    <span style={{ fontWeight: '700', color: 'var(--accent)' }}>GH₵ {(item.quantity * item.cost_price).toFixed(2)}</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px' }} onClick={() => removeItem(item.product_id)}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontWeight: '800', fontSize: '15px' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>GH₵ {poTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this order…" />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : `Create PO — GH₵ ${poTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN INVENTORY PAGE
═══════════════════════════════════════════════════════════════ */
const Inventory = () => {
  const [activeTab, setActiveTab] = useState('movements');

  const tabs = [
    { key: 'movements',      label: '📋 Stock Movements' },
    { key: 'suppliers',      label: '🏭 Suppliers' },
    { key: 'purchase_orders',label: '📦 Purchase Orders' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Stock movements, suppliers and purchase orders</p>
        </div>
      </div>

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

      {activeTab === 'movements'       && <MovementsTab />}
      {activeTab === 'suppliers'       && <SuppliersTab />}
      {activeTab === 'purchase_orders' && <PurchaseOrdersTab />}
    </div>
  );
};

export default Inventory;
