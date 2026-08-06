import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, productsAPI } from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const MOVEMENT_COLORS = {
  purchase:   { bg: '#dcfce7', color: '#16a34a' },
  sale:       { bg: '#dbeafe', color: '#1d4ed8' },
  return:     { bg: '#ede9fe', color: '#7c3aed' },
  adjustment: { bg: '#fef3c7', color: '#d97706' },
  damage:     { bg: '#fee2e2', color: '#dc2626' },
};
const MovementBadge = ({ type }) => {
  const c = MOVEMENT_COLORS[type] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{type}</span>;
};

const PO_COLORS = {
  received:  { bg: '#dcfce7', color: '#16a34a' },
  partial:   { bg: '#dbeafe', color: '#1d4ed8' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
};
const POBadge = ({ status }) => {
  const c = PO_COLORS[status] || { bg: '#fef3c7', color: '#d97706' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{status}</span>;
};

const smallBtnStyle = { padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 };

/* ═══════════════════════════════════════════════════════════════
   TAB: Stock Movements
═══════════════════════════════════════════════════════════════ */
function MovementsTab() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'adjustment', quantity: '', notes: '' });
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [movRes, prodRes] = await Promise.all([
        inventoryAPI.getMovements({ limit: PAGE_SIZE, page }),
        productsAPI.getAll({ limit: 100 }),
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{total} movements</span>
        <button onClick={() => setShowModal(true)} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>+ Adjust Stock</button>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : movements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ color: '#6b7280' }}>No stock movements yet</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {movements.map(m => (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{m.product_name || '—'}</div>
                    <div style={{ marginTop: 4 }}><MovementBadge type={m.type} /></div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: m.quantity > 0 ? '#22c55e' : '#dc2626' }}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </div>
                </div>
                {m.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{m.notes}</div>}
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{fmtDate(m.created_at)}{m.created_by_name ? ` · ${m.created_by_name}` : ''}</div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ ...smallBtnStyle, background: '#f3f4f6', color: '#374151', opacity: page === 1 ? 0.5 : 1 }}>← Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ ...smallBtnStyle, background: '#f3f4f6', color: '#374151', opacity: page === totalPages ? 0.5 : 1 }}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Adjust Stock</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Product *</label>
            <select className="form-input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} style={{ width: '100%', marginBottom: 10 }}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Type *</label>
                <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%' }}>
                  <option value="adjustment">Adjustment</option>
                  <option value="return">Return</option>
                  <option value="damage">Damage</option>
                  <option value="transfer">Transfer</option>
                  <option value="purchase">Purchase</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Quantity *</label>
                <input className="form-input" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Use negative to remove" style={{ width: '100%' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment…" style={{ width: '100%', marginBottom: 16, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdjust} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: Suppliers
═══════════════════════════════════════════════════════════════ */
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={openAdd} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>+ Add Supplier</button>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>No suppliers yet</p>
          <button onClick={openAdd} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>+ Add Supplier</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suppliers.map(s => (
            <div key={s.id} onClick={() => openEdit(s)} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{s.name}</div>
                <span style={{ fontSize: 16, color: '#9ca3af' }}>›</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {s.phone || '—'}{s.email ? ` · ${s.email}` : ''}
              </div>
              {s.address && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>📍 {s.address}</div>}
              {s.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Supplier Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Accra Bike Parts Ltd" style={{ width: '100%', marginBottom: 10 }} />

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0244123456" style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" style={{ width: '100%' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Address</label>
            <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Accra, Ghana" style={{ width: '100%', marginBottom: 10 }} />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this supplier…" style={{ width: '100%', marginBottom: 16, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: Purchase Orders
═══════════════════════════════════════════════════════════════ */
function PurchaseOrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', notes: '', items: [] });
  const [selProduct, setSelProduct] = useState('');
  const [selQty, setSelQty] = useState(1);
  const [selCost, setSelCost] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const [ordRes, supRes, prodRes] = await Promise.all([
        inventoryAPI.getPurchaseOrders({ limit: 50 }),
        inventoryAPI.getSuppliers({ limit: 100 }),
        productsAPI.getAll({ limit: 100 }),
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

  const handleCreate = async () => {
    if (!form.supplier_id) return alert('Please select a supplier');
    if (!form.items.length) return alert('Please add at least one product');
    try {
      setSaving(true);
      await inventoryAPI.createPurchaseOrder({
        supplier_id: parseInt(form.supplier_id),
        notes: form.notes,
        items: form.items.map(i => ({ product_id: i.product_id, quantity_ordered: i.quantity, unit_cost: i.cost_price })),
      });
      setShowModal(false);
      setForm({ supplier_id: '', notes: '', items: [] });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating purchase order');
    } finally {
      setSaving(false);
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{orders.length} purchase orders</span>
        <button onClick={() => setShowModal(true)} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>+ New PO</button>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>No purchase orders yet</p>
          <button onClick={() => setShowModal(true)} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>+ New Purchase Order</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(po => (
            <div key={po.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{po.reference}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', marginTop: 2 }}>{po.supplier_name || '—'}</div>
                </div>
                <POBadge status={po.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{fmt(po.total_amount)}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {po.expected_date ? `Expected ${fmtDateShort(po.expected_date)}` : fmtDateShort(po.created_at)}
                </span>
              </div>
              {po.status === 'pending' && (
                <button
                  onClick={() => handleReceive(po)}
                  disabled={receiving === po.id}
                  style={{ ...smallBtnStyle, width: '100%', marginTop: 10, background: '#f0fdf4', color: '#16a34a' }}
                >
                  {receiving === po.id ? 'Receiving…' : '✓ Mark Received'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '88vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>New Purchase Order</h3>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Supplier *</label>
              <select className="form-input" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Add Products *</label>
            <select className="form-input" value={selProduct} onChange={e => setSelProduct(e.target.value)} style={{ width: '100%', marginBottom: 6 }}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input className="form-input" type="number" min="1" value={selQty} onChange={e => setSelQty(parseInt(e.target.value) || 1)} style={{ width: 64 }} placeholder="Qty" />
              <input className="form-input" type="number" min="0" step="0.01" value={selCost} onChange={e => setSelCost(e.target.value)} style={{ flex: 1 }} placeholder="Cost (GH₵)" />
              <button onClick={addItem} style={{ ...smallBtnStyle, background: '#1a1a18', color: '#fff' }}>Add</button>
            </div>

            {form.items.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                {form.items.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{item.quantity} × {fmt(item.cost_price)}</span>
                    <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{fmt(item.quantity * item.cost_price)}</span>
                    <button onClick={() => removeItem(item.product_id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontWeight: 800, fontSize: 15 }}>
                  <span>Total</span>
                  <span style={{ color: '#22c55e' }}>{fmt(poTotal)}</span>
                </div>
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this order…" style={{ width: '100%', marginBottom: 16, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Creating…' : `Create — ${fmt(poTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PORTAL INVENTORY PAGE
═══════════════════════════════════════════════════════════════ */
export default function PortalInventory() {
  const [activeTab, setActiveTab] = useState('movements');

  const tabs = [
    { key: 'movements', label: '📋 Movements' },
    { key: 'suppliers', label: '🏭 Suppliers' },
    { key: 'purchase_orders', label: '📦 Purchase Orders' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Inventory</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Stock movements, suppliers and purchase orders</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? '#1a1a18' : '#fff',
              color: activeTab === tab.key ? '#fff' : '#6b7280',
              boxShadow: activeTab === tab.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'movements' && <MovementsTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'purchase_orders' && <PurchaseOrdersTab />}
    </div>
  );
}
