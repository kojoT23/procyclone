import React, { useState, useEffect, useCallback, useRef } from 'react';
import { productsAPI } from '../utils/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef();
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock_quantity: '',
    low_stock_threshold: '5', category: '', image_url: '',
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const res = await productsAPI.getAll(params);
      setProducts(res.data.products || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', stock_quantity: '', low_stock_threshold: '5', category: '', image_url: '' });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      stock_quantity: product.stock_quantity || '',
      low_stock_threshold: product.low_stock_threshold || '5',
      category: product.category || '',
      image_url: product.image_url || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return alert('Name and price are required');
    try {
      setSaving(true);
      if (editing) {
        await productsAPI.update(editing.id, form);
      } else {
        await productsAPI.create(form);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productsAPI.delete(id);
      fetchProducts();
    } catch (err) {
      alert('Error deleting product');
    }
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImporting(true);
        setImportResult(null);
        const text = event.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

        const products = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length < 2) continue;
          const product = {};
          headers.forEach((header, index) => {
            product[header] = values[index] || '';
          });
          if (product.name) products.push(product);
        }

        if (products.length === 0) {
          alert('No valid products found in CSV');
          return;
        }

        const res = await productsAPI.bulkImport({ products });
        setImportResult(res.data);
        fetchProducts();
      } catch (err) {
        alert(err.response?.data?.message || 'Import failed');
      } finally {
        setImporting(false);
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = `name,description,price,stock_quantity,low_stock_threshold,category
Mountain Bike Helmet,Premium safety helmet,150.00,20,5,Helmets
Road Bike Gloves,Padded cycling gloves,45.00,50,10,Accessories
Water Bottle,750ml cycling bottle,25.00,100,20,Accessories`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'procyclone_products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const stockColor = (qty, threshold) => {
    if (qty === 0) return '#e74c3c';
    if (qty <= threshold) return '#f39c12';
    return '#2ecc71';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>{total} products in inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={downloadTemplate} style={{ fontSize: '12px' }}>
            📥 CSV Template
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current.click()}
            disabled={importing}
            style={{ fontSize: '12px' }}
          >
            {importing ? '⏳ Importing...' : '📤 Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCSVImport}
          />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div style={{
          background: '#d4edda', border: '1px solid #c3e6cb',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#155724', fontSize: '14px' }}>
            ✅ {importResult.message}
            {importResult.errors?.length > 0 && ` — ${importResult.errors.length} errors`}
          </span>
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="🔍 Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-secondary" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>��</div>
            <h3>No products yet</h3>
            <p>Add products manually or import from CSV</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={downloadTemplate}>📥 Get Template</button>
              <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{product.name}</div>
                        {product.description && (
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                            {product.description.substring(0, 50)}{product.description.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{product.category || '—'}</td>
                      <td style={{ fontWeight: '600' }}>GH₵ {parseFloat(product.price || 0).toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: stockColor(product.stock_quantity, product.low_stock_threshold),
                            display: 'inline-block', flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: '600' }}>{product.stock_quantity}</span>
                        </div>
                      </td>
                      <td>
                        {product.stock_quantity === 0 ? (
                          <span style={{ background: '#f8d7da', color: '#721c24', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Out of stock</span>
                        ) : product.stock_quantity <= product.low_stock_threshold ? (
                          <span style={{ background: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Low stock</span>
                        ) : (
                          <span style={{ background: '#d4edda', color: '#155724', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>In stock</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(product)}>Edit</button>
                          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleDelete(product.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mountain Bike Helmet" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Price (GH₵) *</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Stock Quantity</label>
                <input className="form-input" type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Helmets" />
              </div>
              <div className="form-group">
                <label className="form-label">Low Stock Alert</label>
                <input className="form-input" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} placeholder="5" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Image URL</label>
              <input className="form-input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
