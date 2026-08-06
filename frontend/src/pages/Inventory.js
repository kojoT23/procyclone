import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

/* ─── API ─────────────────────────────────────────────────────── */
const inventoryAPI = {
  getMovements:        (params) => API.get('/inventory/movements', { params }),
  adjustStock:         (data)   => API.post('/inventory/movements/adjust', data),
  getSuppliers:        (params) => API.get('/inventory/suppliers', { params }),
  createSupplier:      (data)   => API.post('/inventory/suppliers', data),
  updateSupplier:      (id, data) => API.put(`/inventory/suppliers/${id}`, data),
  deleteSupplier:      (id)       => API.delete(`/inventory/suppliers/${id}`),
  getPurchaseOrders:   (params) => API.get('/inventory/purchase-orders', { params }),
  getPurchaseOrder:    (id)     => API.get(`/inventory/purchase-orders/${id}`),
  createPurchaseOrder: (data)   => API.post('/inventory/purchase-orders', data),
  updatePurchaseOrder: (id, data) => API.put(`/inventory/purchase-orders/${id}`, data),
  cancelPurchaseOrder: (id)     => API.put(`/inventory/purchase-orders/${id}/cancel`),
  receivePurchaseOrder:(id, data)=> API.post(`/inventory/purchase-orders/${id}/receive`, data),
};

const productsAPI_local = {
  getAll: (params) => API.get('/products', { params }),
  getByBarcode: (code) => API.get(`/products/barcode/${encodeURIComponent(code)}`),
};

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
  const [scanCode,   setScanCode]   = useState('');
  const [scanError,  setScanError]  = useState('');
  const [scanning,   setScanning]   = useState(false);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType,    setFilterType]    = useState('');
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [movRes, prodRes] = await Promise.all([
        inventoryAPI.getMovements({ limit: PAGE_SIZE, page, product_id: filterProduct || undefined, type: filterType || undefined }),
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
  }, [page, filterProduct, filterType]);

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

  // A real barcode scanner just types the code fast and sends Enter — no
  // special hardware integration needed, this is just a text field that
  // reacts to Enter the way any scanner "keyboard emulation" mode expects.
  const handleScan = async (e) => {
    if (e.key !== 'Enter' || !scanCode.trim()) return;
    setScanning(true);
    setScanError('');
    try {
      const res = await productsAPI_local.getByBarcode(scanCode.trim());
      const product = res.data.product;
      setForm({ product_id: String(product.id), type: 'adjustment', quantity: '', notes: '' });
      setScanCode('');
      setShowModal(true);
    } catch (err) {
      setScanError(err.response?.data?.message || `No product found for barcode ${scanCode}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>📷 Scan Barcode</label>
        <input
          className="form-input"
          value={scanCode}
          onChange={e => { setScanCode(e.target.value); setScanError(''); }}
          onKeyDown={handleScan}
          placeholder="Scan or type a barcode, then press Enter"
          disabled={scanning}
          autoFocus
        />
        {scanError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '6px 0 0' }}>{scanError}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <span className="pagination-info">{total} movements</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: '200px' }} value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }}>
            <option value="">All products</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-input" style={{ width: '150px' }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="adjustment">Adjustment</option>
            <option value="damage">Damage</option>
            <option value="transfer">Transfer</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Adjust Stock</button>
        </div>
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
            <h3>{filterProduct || filterType ? 'No movements match these filters' : 'No stock movements yet'}</h3>
            <p>{filterProduct || filterType ? 'Try clearing a filter' : 'Stock changes will appear here automatically'}</p>
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
  const [search,    setSearch]    = useState('');
  const [form,      setForm]      = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryAPI.getSuppliers({ limit: 100, search: search || undefined });
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

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

  const handleDelete = async (s) => {
    if (!window.confirm(`Remove "${s.name}" from your supplier list? Past shipments and purchase orders tied to them are kept — they just won't show up as an option for new ones.`)) return;
    try {
      await inventoryAPI.deleteSupplier(s.id);
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error removing supplier');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <input
          className="form-input"
          style={{ maxWidth: '280px' }}
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
            <h3>{search ? 'No suppliers match your search' : 'No suppliers yet'}</h3>
            <p>{search ? 'Try a different name, phone, or email' : 'Add suppliers to use them in purchase orders'}</p>
            {!search && <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Supplier</button>}
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
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)} style={{ marginRight: '6px' }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>Delete</button>
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
  const [editingPO, setEditingPO] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
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

  const openCreate = () => {
    setEditingPO(null);
    setForm({ supplier_id: '', expected_date: '', notes: '', items: [] });
    setShowModal(true);
  };

  const openEditPO = async (po) => {
    try {
      const res = await inventoryAPI.getPurchaseOrder(po.id);
      const full = res.data.purchase_order;
      setEditingPO(full);
      setForm({
        supplier_id: String(full.supplier_id || ''),
        expected_date: full.expected_date ? full.expected_date.split('T')[0] : '',
        notes: full.notes || '',
        items: (full.items || []).map(i => ({
          product_id: i.product_id, name: i.product_name, quantity: i.quantity_ordered, cost_price: parseFloat(i.unit_cost),
        })),
      });
      setShowModal(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Error loading purchase order');
    }
  };

  /* Create PO */
  const handleSave = async () => {
    if (!form.supplier_id)      return alert('Please select a supplier');
    if (!form.items.length)     return alert('Please add at least one product');
    try {
      setSaving(true);
      const payload = {
        supplier_id:   parseInt(form.supplier_id),
        expected_date: form.expected_date || null,
        notes:         form.notes,
        items:         form.items.map(i => ({ product_id: i.product_id, quantity_ordered: i.quantity, unit_cost: i.cost_price })),
      };
      if (editingPO) {
        await inventoryAPI.updatePurchaseOrder(editingPO.id, payload);
      } else {
        await inventoryAPI.createPurchaseOrder(payload);
      }
      setShowModal(false);
      setEditingPO(null);
      setForm({ supplier_id: '', expected_date: '', notes: '', items: [] });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPO = async (po) => {
    if (!window.confirm(`Cancel purchase order ${po.reference}? This can't be undone.`)) return;
    try {
      setCancelling(po.id);
      await inventoryAPI.cancelPurchaseOrder(po.id);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling purchase order');
    } finally {
      setCancelling(null);
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
        <button className="btn btn-primary" onClick={openCreate}>+ New Purchase Order</button>
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
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openCreate}>+ New Purchase Order</button>
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
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleReceive(po)}
                            disabled={receiving === po.id}
                          >
                            {receiving === po.id ? 'Receiving…' : '✓ Mark Received'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditPO(po)}>Edit</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancelPO(po)}
                            disabled={cancelling === po.id}
                          >
                            {cancelling === po.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </div>
                      )}
                      {po.status === 'cancelled' && (
                        <span className="badge badge-red">✕ Cancelled</span>
                      )}
                      {po.status !== 'pending' && po.status !== 'cancelled' && (
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

      {/* Create/Edit PO Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingPO(null); }}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingPO ? `Edit ${editingPO.reference}` : 'New Purchase Order'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); setEditingPO(null); }}>✕</button>
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
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowModal(false); setEditingPO(null); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingPO ? `Save Changes — GH₵ ${poTotal.toFixed(2)}` : `Create PO — GH₵ ${poTotal.toFixed(2)}`}
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
const StockAlertBanner = () => {
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState([]);
  const [outOfStock, setOutOfStock] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    productsAPI_local.getAll({ limit: 500 }).then(res => {
      const products = (res.data.products || []).filter(p => p.is_active);
      setOutOfStock(products.filter(p => p.stock_quantity === 0));
      setLowStock(products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold ?? 0)));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || (lowStock.length === 0 && outOfStock.length === 0)) return null;

  return (
    <div
      className="card"
      style={{ marginBottom: '16px', padding: '14px 16px', background: outOfStock.length ? '#fef2f2' : '#fffbeb', border: `1px solid ${outOfStock.length ? '#fecaca' : '#fde68a'}`, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: '700', fontSize: '13px', color: outOfStock.length ? '#b91c1c' : '#92400e' }}>
          ⚠️ {outOfStock.length > 0 && `${outOfStock.length} out of stock`}
          {outOfStock.length > 0 && lowStock.length > 0 && ' · '}
          {lowStock.length > 0 && `${lowStock.length} running low`}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{expanded ? 'Hide ▲' : 'Show ▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {outOfStock.map(p => (
            <div key={p.id} style={{ fontSize: '12px', color: '#b91c1c' }}>🔴 {p.name} — 0 in stock</div>
          ))}
          {lowStock.map(p => (
            <div key={p.id} style={{ fontSize: '12px', color: '#92400e' }}>🟠 {p.name} — {p.stock_quantity} left (threshold {p.low_stock_threshold})</div>
          ))}
        </div>
      )}
    </div>
  );
};

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

      <StockAlertBanner />

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
