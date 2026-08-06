import React, { useState, useEffect, useCallback, useRef } from 'react';
import { productsAPI, inventoryAPI } from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const getDiscount = (price, comparePrice) => {
  if (!comparePrice || comparePrice <= price) return null;
  return Math.round((1 - price / comparePrice) * 100);
};

const stockBadge = (product) => {
  if (product.stock_quantity === 0) return { bg: '#fee2e2', color: '#dc2626', label: 'Out of stock' };
  if (product.stock_quantity <= product.low_stock_threshold) return { bg: '#fef3c7', color: '#d97706', label: 'Low stock' };
  return { bg: '#dcfce7', color: '#16a34a', label: 'In stock' };
};

const EMPTY_FORM = {
  name: '', description: '', price: '', compare_price: '',
  stock_quantity: '', low_stock_threshold: '5', category: '',
  image_url: '', image_base64: '', is_deal: false, is_active: true,
  badge: '', rating: '', review_count: '',
};

const MODAL_SECTIONS = [
  { key: 'basic',   label: '📦 Basic' },
  { key: 'pricing', label: '💰 Pricing' },
  { key: 'stock',   label: '🏭 Stock' },
  { key: 'media',   label: '🖼️ Media' },
  { key: 'extra',   label: '⭐ Extra' },
];

const sectionStyle = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 };
const labelStyle = { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 };
const errStyle = { fontSize: 11, color: '#dc2626', marginTop: 4 };
const smallBtnStyle = { padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const qtyBtnStyle = { ...smallBtnStyle, width: 36, background: '#f3f4f6', color: '#374151', fontSize: 16 };
const smallInputStyle = { padding: '8px 6px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 };

export default function PortalProducts() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState(''); // '', 'low', 'out', 'inactive'
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const photoInputRef = useRef(null);

  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');

  const [historyProduct, setHistoryProduct] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterStock === 'low') params.low_stock = true;
      if (filterStock === 'out') params.out_of_stock = true;
      if (filterStock === 'inactive') params.is_active = false;
      const res = await productsAPI.getAll(params);
      const list = res.data.products || [];
      setProducts(list);
      setTotal(res.data.total || list.length);
      const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
      if (cats.length) setCategories(prev => [...new Set([...prev, ...cats])]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStock]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Product name is required';
    if (!form.price || parseFloat(form.price) <= 0) errs.price = 'Price must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setActiveSection('basic');
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name:                product.name               || '',
      description:         product.description        || '',
      price:               product.price               || '',
      compare_price:       product.compare_price       || '',
      stock_quantity:      product.stock_quantity     ?? '',
      low_stock_threshold: product.low_stock_threshold || '5',
      category:            product.category            || '',
      image_url:           product.image_url           || '',
      image_base64:        '',
      is_deal:             product.is_deal             || false,
      is_active:           product.is_active           !== false,
      badge:               product.badge               || '',
      rating:              product.rating              || '',
      review_count:        product.review_count        || '',
    });
    setErrors({});
    setActiveSection('basic');
    setShowModal(true);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, image_base64: reader.result, image_url: '' }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, image_url: form.image_base64 || form.image_url };
      delete payload.image_base64;
      editing
        ? await productsAPI.update(editing.id, payload)
        : await productsAPI.create(payload);
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    try {
      await productsAPI.delete(product.id);
      fetchProducts();
    } catch {
      alert('Error deleting product');
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await productsAPI.update(product.id, { is_active: !product.is_active });
      fetchProducts();
    } catch {
      alert('Error updating product');
    }
  };

  const handleQuickAdjust = async (product, delta) => {
    const newQty = Math.max(0, product.stock_quantity + delta);
    try {
      await productsAPI.updateStock(product.id, { stock_quantity: newQty, action: 'set' });
      fetchProducts();
    } catch {
      alert('Error updating stock');
    }
  };

  const handleManualAdjust = async (product) => {
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty < 0) return;
    try {
      await productsAPI.updateStock(product.id, { stock_quantity: qty, action: 'set' });
      setAdjustingId(null);
      setAdjustQty('');
      fetchProducts();
    } catch {
      alert('Error updating stock');
    }
  };

  const openHistory = async (product) => {
    setHistoryProduct(product);
    setStockHistory([]);
    setLoadingHistory(true);
    try {
      const res = await inventoryAPI.getMovements({ product_id: product.id, limit: 20 });
      setStockHistory(res.data.movements || []);
    } catch {
      setStockHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const quickFilters = [
    { key: '', label: 'All' },
    { key: 'low', label: '⚠️ Low' },
    { key: 'out', label: '🔴 Out' },
    { key: 'inactive', label: '⏸️ Inactive' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Products</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{total} in catalog</p>
        </div>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
      </div>

      <input
        className="form-input"
        placeholder="🔍 Search products…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />

      {categories.length > 0 && (
        <select className="form-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {quickFilters.map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilterStock(f.key)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: filterStock === f.key ? '#1a1a18' : '#fff',
              color: filterStock === f.key ? '#fff' : '#6b7280',
              boxShadow: filterStock === f.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
          <p style={{ color: '#6b7280' }}>{search || filterStock || filterCategory ? 'No products match your filters.' : 'Add your first product to get started.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {products.map(product => {
            const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));
            const badge = stockBadge(product);
            return (
              <div key={product.id} style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(product)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{product.name}</div>
                      {!product.is_active && <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', flexShrink: 0 }}>Inactive</span>}
                    </div>
                    {product.category && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{product.category}</div>}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{fmt(product.price)}</span>
                      {discount && <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(product.compare_price)}</span>}
                      {discount && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>-{discount}%</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: badge.bg, color: badge.color }}>{badge.label} · {product.stock_quantity}</span>
                      {product.is_deal && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fff7ed', color: '#c2410c' }}>🔥 Deal</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', alignItems: 'center' }}>
                  <button onClick={() => handleQuickAdjust(product, -1)} style={qtyBtnStyle}>−</button>
                  {adjustingId === product.id ? (
                    <>
                      <input
                        type="number" min="0" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                        placeholder={String(product.stock_quantity)}
                        style={{ ...smallInputStyle, width: 64, textAlign: 'center' }}
                      />
                      <button onClick={() => handleManualAdjust(product)} style={{ ...smallBtnStyle, background: '#22c55e', color: '#fff' }}>Set</button>
                      <button onClick={() => { setAdjustingId(null); setAdjustQty(''); }} style={{ ...smallBtnStyle, background: '#f3f4f6', color: '#6b7280' }}>✕</button>
                    </>
                  ) : (
                    <button onClick={() => { setAdjustingId(product.id); setAdjustQty(''); }} style={{ ...smallBtnStyle, background: '#f3f4f6', color: '#374151', flex: 1 }}>
                      Stock: {product.stock_quantity}
                    </button>
                  )}
                  <button onClick={() => handleQuickAdjust(product, 1)} style={qtyBtnStyle}>+</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => openHistory(product)} style={{ ...smallBtnStyle, flex: 1, background: '#eff6ff', color: '#1d4ed8' }}>📋 History</button>
                  <button
                    onClick={() => handleToggleActive(product)}
                    style={{ ...smallBtnStyle, flex: 1, background: product.is_active ? '#fef3c7' : '#f0fdf4', color: product.is_active ? '#92400e' : '#16a34a' }}
                  >
                    {product.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDelete(product)} style={{ ...smallBtnStyle, background: '#fef2f2', color: '#dc2626' }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Add / Edit Modal
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '88vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>{editing ? 'Edit Product' : 'Add Product'}</h3>

            <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#fff', borderRadius: 10, padding: 4, overflowX: 'auto' }}>
              {MODAL_SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  style={{
                    flexShrink: 0, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: activeSection === s.key ? '#1a1a18' : 'transparent', color: activeSection === s.key ? '#fff' : '#6b7280',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {activeSection === 'basic' && (
              <div style={sectionStyle}>
                <label style={labelStyle}>Product Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', marginBottom: 4 }} placeholder="e.g. iPhone 16 Pro" />
                {errors.name && <p style={errStyle}>{errors.name}</p>}

                <label style={{ ...labelStyle, marginTop: 10 }}>Description</label>
                <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width: '100%', resize: 'vertical' }} placeholder="Optional" />

                <label style={{ ...labelStyle, marginTop: 10 }}>Category</label>
                <input className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', marginBottom: 8 }} placeholder="e.g. Electronics" list="portal-product-categories" />
                <datalist id="portal-product-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>

                <label style={labelStyle}>Badge</label>
                <input className="form-input" value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} style={{ width: '100%' }} placeholder="e.g. Best Seller" />
              </div>
            )}

            {activeSection === 'pricing' && (
              <div style={sectionStyle}>
                <label style={labelStyle}>Price (GH₵)</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ width: '100%', marginBottom: 4 }} placeholder="0.00" />
                {errors.price && <p style={errStyle}>{errors.price}</p>}

                <label style={{ ...labelStyle, marginTop: 10 }}>Compare-at Price</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.compare_price} onChange={e => setForm({ ...form, compare_price: e.target.value })} style={{ width: '100%' }} placeholder="Optional — shows a strike-through discount" />
              </div>
            )}

            {activeSection === 'stock' && (
              <div style={sectionStyle}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Stock Quantity</label>
                    <input className="form-input" type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} style={{ width: '100%' }} placeholder="0" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Low Stock Alert</label>
                    <input className="form-input" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} style={{ width: '100%' }} placeholder="5" />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 14 }}>
                  <input type="checkbox" checked={form.is_deal} onChange={e => setForm({ ...form, is_deal: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>🔥 Mark as Deal of the Day</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 10 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Active (visible on storefront)</span>
                </label>
              </div>
            )}

            {activeSection === 'media' && (
              <div style={sectionStyle}>
                <label style={labelStyle}>Product Image</label>
                {(form.image_base64 || form.image_url) && (
                  <div style={{ marginBottom: 10, textAlign: 'center' }}>
                    <img src={form.image_base64 || form.image_url} alt="Preview" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  </div>
                )}
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: 18, textAlign: 'center', cursor: 'pointer', background: '#fff', marginBottom: 10 }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🖼️</div>
                  <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: 13 }}>{form.image_base64 ? 'Tap to change image' : 'Tap to upload image'}</p>
                  <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>JPG or PNG · Max 2MB</p>
                </div>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px', textAlign: 'center' }}>— or paste an image URL —</p>
                <input className="form-input" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value, image_base64: '' })} style={{ width: '100%' }} placeholder="https://example.com/image.jpg" />
                {(form.image_base64 || form.image_url) && (
                  <button onClick={() => setForm({ ...form, image_url: '', image_base64: '' })} style={{ ...smallBtnStyle, marginTop: 8, background: '#fef2f2', color: '#dc2626', width: '100%' }}>Remove image</button>
                )}
              </div>
            )}

            {activeSection === 'extra' && (
              <div style={sectionStyle}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Rating (0–5)</label>
                    <input className="form-input" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} style={{ width: '100%' }} placeholder="e.g. 4.5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Review Count</label>
                    <input className="form-input" type="number" min="0" value={form.review_count} onChange={e => setForm({ ...form, review_count: e.target.value })} style={{ width: '100%' }} placeholder="e.g. 128" />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Stock History Modal
      ══════════════════════════════════════════════════════════ */}
      {historyProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setHistoryProduct(null)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '75vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Stock History — {historyProduct.name}</h3>
              <button onClick={() => setHistoryProduct(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: '#f9f9f8', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Current Stock</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: stockBadge(historyProduct).color, marginTop: 2 }}>{historyProduct.stock_quantity}</div>
              </div>
              <div style={{ flex: 1, background: '#f9f9f8', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Alert At</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginTop: 2 }}>{historyProduct.low_stock_threshold}</div>
              </div>
            </div>

            {loadingHistory ? (
              <div className="loading"><div className="loading-spinner" /></div>
            ) : stockHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p>No stock movements yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stockHistory.map((m, i) => (
                  <div key={i} style={{ background: '#f9f9f8', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: m.quantity > 0 ? '#dcfce7' : '#fee2e2', color: m.quantity > 0 ? '#16a34a' : '#dc2626', textTransform: 'capitalize' }}>{m.type}</span>
                      {m.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{m.notes}</div>}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: m.quantity > 0 ? '#22c55e' : '#dc2626', flexShrink: 0 }}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
