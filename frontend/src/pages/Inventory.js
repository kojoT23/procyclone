import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

const inventoryAPI = {
  getMovements: (params) => API.get('/inventory/movements', { params }),
  adjustStock: (data) => API.post('/inventory/movements/adjust', data),
  getSuppliers: (params) => API.get('/inventory/suppliers', { params }),
  createSupplier: (data) => API.post('/inventory/suppliers', data),
  updateSupplier: (id, data) => API.put(`/inventory/suppliers/${id}`, data),
  getPurchaseOrders: (params) => API.get('/inventory/purchase-orders', { params }),
  createPurchaseOrder: (data) => API.post('/inventory/purchase-orders', data),
  receivePurchaseOrder: (id, data) => API.post(`/inventory/purchase-orders/${id}/receive`, data),
};

const productsAPI_local = {
  getAll: (params) => API.get('/products', { params }),
};

const MOVEMENT_COLORS = {
  purchase:   { bg: '#d4edda', text: '#155724' },
  sale:       { bg: '#cce5ff', text: '#004085' },
  return:     { bg: '#e2d9f3', text: '#4a235a' },
  adjustment: { bg: '#fff3cd', text: '#856404' },
  damage:     { bg: '#f8d7da', text: '#721c24' },
  transfer:   { bg: '#d1ecf1', text: '#0c5460' },
};

// ── Stock Movements Tab ────────────────────────────────────────
const MovementsTab = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'adjustment', quantity: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [movRes, prodRes] = await Promise.all([
        inventoryAPI.getMovements({ limit: 50 }),
        productsAPI_local.getAll({ limit: 100 }),
      ]);
      setMovements(movRes.data.movements || []);
      setProducts(prodRes.data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Adjust Stock</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading movements...</div>
        ) : movements.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <h3>No stock movements yet</h3>
            <p>Stock changes will appear here automatically</p>
          </div>
        ) : (
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
                    <td>
                      <span style={{
                        background: MOVEMENT_COLORS[m.type]?.bg || '#eee',
                        color: MOVEMENT_COLORS[m.type]?.text || '#333',
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: '600', textTransform: 'capitalize',
                      }}>
                        {m.type}
                      </span>
                    </td>
                    <td style={{
                      fontWeight: '700',
                      color: m.quantity > 0 ? '#2ecc71' : '#e74c3c',
                      fontSize: '15px',
                    }}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td style={{ color: '#666', fontSize: '13px' }}>{m.notes || '—'}</td>
                    <td style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
              <h2 className="modal-title">Adjust Stock</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select className="form-input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">Select product...</option>
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
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment..." />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdjust} disabled={saving}>
                {saving ? 'Saving...' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Suppliers Tab ──────────────────────────────────────────────
const SuppliersTab = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryAPI.getSuppliers({ limit: 50 });
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

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({ name: supplier.name || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', notes: supplier.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert('Supplier name is required');
    try {
      setSaving(true);
      if (editing) {
        await inventoryAPI.updateSupplier(editing.id, form);
      } else {
        await inventoryAPI.createSupplier(form);
      }
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
          <div className="loading">Loading suppliers...</div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏭</div>
            <h3>No suppliers yet</h3>
            <p>Add your product suppliers here</p>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td>{s.phone || '—'}</td>
                    <td style={{ color: '#666', fontSize: '13px' }}>{s.email || '—'}</td>
                    <td style={{ color: '#666', fontSize: '13px' }}>{s.address || '—'}</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(s)}>Edit</button>
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
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
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
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this supplier..." />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Purchase Orders Tab ────────────────────────────────────────
const PurchaseOrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryAPI.getPurchaseOrders({ limit: 50 });
      setOrders(res.data.purchase_orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const STATUS_COLORS = {
    pending:   { bg: '#fff3cd', text: '#856404' },
    received:  { bg: '#d4edda', text: '#155724' },
    partial:   { bg: '#cce5ff', text: '#004085' },
    cancelled: { bg: '#f8d7da', text: '#721c24' },
  };

  return (
    <div>
      <div className="card">
        {loading ? (
          <div className="loading">Loading purchase orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <h3>No purchase orders yet</h3>
            <p>Purchase orders will appear here when created</p>
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
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(po => (
                  <tr key={po.id}>
                    <td style={{ fontWeight: '600' }}>{po.reference}</td>
                    <td>{po.supplier_name || '—'}</td>
                    <td>
                      <span style={{
                        background: STATUS_COLORS[po.status]?.bg || '#eee',
                        color: STATUS_COLORS[po.status]?.text || '#333',
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: '600', textTransform: 'capitalize',
                      }}>
                        {po.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>GH₵ {parseFloat(po.total_amount || 0).toFixed(2)}</td>
                    <td style={{ color: '#888', fontSize: '12px' }}>
                      {new Date(po.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Inventory Page ────────────────────────────────────────
const Inventory = () => {
  const [activeTab, setActiveTab] = useState('movements');

  const tabs = [
    { key: 'movements', label: '📋 Stock Movements' },
    { key: 'suppliers', label: '🏭 Suppliers' },
    { key: 'purchase_orders', label: '📦 Purchase Orders' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>Stock movements, suppliers and purchase orders</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              color: activeTab === tab.key ? '#1a1a2e' : '#888',
              borderBottom: activeTab === tab.key ? '2px solid #1a1a2e' : '2px solid transparent',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
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
};

export default Inventory;
