import React, { useState, useEffect, useCallback, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { productsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useFormValidation, FormError, inputStyle, rules } from '../utils/useFormValidation';

/* ─── Barcode preview — renders whatever's in the barcode field as an
   actual scannable CODE128 barcode, so staff can confirm it looks right
   before printing rather than just seeing a string of digits. ─────── */
const BarcodePreview = ({ value }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, { format: 'CODE128', width: 1.5, height: 40, fontSize: 12, margin: 4 });
      } catch (e) {
        // Not a valid CODE128 value yet (e.g. still mid-typing) — the
        // field itself still saves fine, this just skips the preview.
      }
    }
  }, [value]);
  return <canvas ref={canvasRef} />;
};

/* ─── CSV helper ──────────────────────────────────────────────── */
const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && (v.includes(',') || v.includes('"'))
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const getDiscount = (price, comparePrice) => {
  if (!comparePrice || comparePrice <= price) return null;
  return Math.round((1 - price / comparePrice) * 100);
};

const stockDotColor = (qty, threshold) => {
  if (qty === 0)          return '#ef4444';
  if (qty <= threshold)   return '#f59e0b';
  return 'var(--accent, #22c55e)';
};

const StockBadge = ({ product }) => {
  if (product.stock_quantity === 0)
    return <span className="badge badge-red">Out of stock</span>;
  if (product.stock_quantity <= product.low_stock_threshold)
    return <span className="badge badge-amber">Low stock</span>;
  return <span className="badge badge-green">In stock</span>;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Products = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  /* ── List state ──────────────────────────────────────────────── */
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [search,       setSearch]       = useState('');
  const [filterCat,    setFilterCat]    = useState('');
  const [filterStock,  setFilterStock]  = useState('');
  const [sortBy,       setSortBy]       = useState('created_at');
  const [sortDir,      setSortDir]      = useState('desc');
  const [categories,   setCategories]   = useState([]);

  /* ── Bulk selection ──────────────────────────────────────────── */
  const [selected,     setSelected]     = useState([]);

  /* ── Import ──────────────────────────────────────────────────── */
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef   = useRef();
  const photoInputRef  = useRef();

  /* ── Modal ───────────────────────────────────────────────────── */
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  /* ── Quick stock adjust ──────────────────────────────────────── */
  const [adjustingId,  setAdjustingId]  = useState(null);
  const [adjustQty,    setAdjustQty]    = useState('');

  /* ── Stock history modal ─────────────────────────────────────── */
  const [historyProduct, setHistoryProduct] = useState(null);
  const [stockHistory,   setStockHistory]   = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ── AI trending suggestions ─────────────────────────────────── */
  const [showTrending,     setShowTrending]     = useState(false);
  const [trendingLoading,  setTrendingLoading]  = useState(false);
  const [trendingError,    setTrendingError]    = useState('');
  const [trendingResults,  setTrendingResults]  = useState([]);
  const [trendingCategory, setTrendingCategory] = useState('');

  const EMPTY_FORM = {
    name: '', description: '', price: '', cost_price: '', compare_price: '',
    sku: '', barcode: '',
    stock_quantity: '', low_stock_threshold: '5', category: '',
    image_url: '', image_base64: '', is_deal: false, is_active: true,
    badge: '', rating: '', review_count: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);

  /* ── Validation ──────────────────────────────────────────────── */
  const productSchema = {
    name:  [rules.required('Product name')],
    price: [rules.required('Price'), rules.min(0.01, 'Price')],
  };
  const { errors: fe, validateAll: va, clearError: ce, clearAll: ca } = useFormValidation(productSchema);

  /* ── Fetch ───────────────────────────────────────────────────── */
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20, sort: sortBy, dir: sortDir };
      if (search)      params.search     = search;
      if (filterCat)   params.category   = filterCat;
      if (filterStock === 'low')      params.low_stock   = true;
      if (filterStock === 'out')      params.out_of_stock = true;
      if (filterStock === 'inactive') params.is_active   = false;
      const res = await productsAPI.getAll(params);
      setProducts(res.data.products || []);
      setTotal(res.data.total  || 0);
      setPages(res.data.pages  || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCat, filterStock, sortBy, sortDir]);

  // Full category list, independent of pagination/filters — powers the
  // filter dropdown and the add/edit form's datalist.
  const fetchCategories = useCallback(async () => {
    try {
      const res = await productsAPI.getCategories();
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { setPage(1); setSelected([]); }, [search, filterCat, filterStock]);

  /* ── Sort toggle ─────────────────────────────────────────────── */
  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const SortIcon = ({ col }) => sortBy !== col ? null : <span>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>;

  /* ── Bulk select ─────────────────────────────────────────────── */
  const toggleSelect    = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSelectAll = () => setSelected(selected.length === products.length ? [] : products.map(p => p.id));

  /* ── Bulk delete ─────────────────────────────────────────────── */
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected products? This cannot be undone.`)) return;
    try {
      await Promise.all(selected.map(id => productsAPI.delete(id)));
      setSelected([]);
      fetchProducts();
    } catch {
      alert('Error deleting selected products');
    }
  };

  /* ── Bulk mark as deal ───────────────────────────────────────── */
  const handleBulkDeal = async () => {
    try {
      await Promise.all(selected.map(id => productsAPI.update(id, { is_deal: true })));
      setSelected([]);
      fetchProducts();
    } catch {
      alert('Error updating products');
    }
  };

  /* ── Export CSV ──────────────────────────────────────────────── */
  const handleExportCSV = () => {
    downloadCSV(
      products.map(p => ({
        Name:              p.name,
        Description:       p.description || '',
        'Price (GH₵)':    parseFloat(p.price || 0).toFixed(2),
        'Cost (GH₵)':     p.cost_price ? parseFloat(p.cost_price).toFixed(2) : '',
        'SKU':            p.sku || '',
        'Barcode':        p.barcode || '',
        'Compare Price':   p.compare_price ? parseFloat(p.compare_price).toFixed(2) : '',
        Stock:             p.stock_quantity,
        'Low Stock Alert': p.low_stock_threshold,
        Category:          p.category || '',
        Badge:             p.badge || '',
        'Is Deal':         p.is_deal ? 'Yes' : 'No',
        'Is Active':       p.is_active !== false ? 'Yes' : 'No',
        Rating:            p.rating || '',
        'Review Count':    p.review_count || '',
        'Image URL':       p.image_url || '',
      })),
      `products-export-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  /* ── CSV import ──────────────────────────────────────────────── */
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImporting(true);
        setImportResult(null);
        const text    = event.target.result;
        const lines   = text.split('\n').filter(l => l.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const prods   = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length < 2) continue;
          const product = {};
          headers.forEach((header, index) => { product[header] = values[index] || ''; });
          if (product.name) prods.push(product);
        }
        if (!prods.length) { alert('No valid products found in CSV'); return; }
        const res = await productsAPI.bulkImport({ products: prods });
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

  /* ── CSV template ────────────────────────────────────────────── */
  const downloadTemplate = () => {
    const csv = `name,description,price,cost_price,compare_price,stock_quantity,low_stock_threshold,category,badge,is_deal,rating,review_count
iPhone 16 Pro,Latest Apple smartphone,2500.00,1800.00,3000.00,10,3,Electronics,Best Seller,true,4.8,128
Nike Air Force 1,Classic white sneakers,850.00,520.00,1200.00,5,2,Footwear,Hot Deal,true,4.5,64`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'products_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Photo upload ────────────────────────────────────────────── */
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, image_base64: reader.result, image_url: '' }));
    reader.readAsDataURL(file);
  };

  /* ── Quick stock adjust ──────────────────────────────────────── */
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
    if (isNaN(qty)) return;
    try {
      await productsAPI.updateStock(product.id, { stock_quantity: qty, action: 'set' });
      setAdjustingId(null);
      setAdjustQty('');
      fetchProducts();
    } catch {
      alert('Error updating stock');
    }
  };

  /* ── Toggle active ───────────────────────────────────────────── */
  const handleToggleActive = async (product) => {
    try {
      await productsAPI.update(product.id, { is_active: !product.is_active });
      fetchProducts();
    } catch {
      alert('Error updating product');
    }
  };

  /* ── Duplicate product ───────────────────────────────────────── */
  const handleDuplicate = async (product) => {
    try {
      await productsAPI.create({
        ...product,
        name:          `${product.name} (Copy)`,
        stock_quantity: 0,
        id:            undefined,
        created_at:    undefined,
        updated_at:    undefined,
      });
      fetchProducts();
    } catch {
      alert('Error duplicating product');
    }
  };

  /* ── Stock history ───────────────────────────────────────────── */
  const openHistory = async (product) => {
    setHistoryProduct(product);
    setStockHistory([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/inventory/movements?product_id=${product.id}&limit=20`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const data = await res.json();
      setStockHistory(data.movements || []);
    } catch {
      setStockHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  /* ── Delete ──────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try {
      await productsAPI.delete(id);
      fetchProducts();
    } catch {
      alert('Error deleting product');
    }
  };

  /* ── Open add / edit ─────────────────────────────────────────── */
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveSection('basic');
    ca();
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name:               product.name              || '',
      description:        product.description       || '',
      price:              product.price             || '',
      cost_price:         product.cost_price        ?? '',
      compare_price:      product.compare_price     || '',
      sku:                product.sku               || '',
      barcode:            product.barcode           || '',
      stock_quantity:     product.stock_quantity    ?? '',
      low_stock_threshold: product.low_stock_threshold || '5',
      category:           product.category          || '',
      image_url:          product.image_url         || '',
      image_base64:       '',
      is_deal:            product.is_deal           || false,
      is_active:          product.is_active         !== false,
      badge:              product.badge             || '',
      rating:             product.rating            || '',
      review_count:       product.review_count      || '',
    });
    setActiveSection('basic');
    ca();
    setShowModal(true);
  };

  /* ── AI trending suggestions ────────────────────────────────────
     Calls the backend, which asks Claude (with web search) for real,
     current trending products — not invented ones. "Use this" prefills
     the normal Add Product form so nothing bypasses your usual
     review/validation before saving. */
  const fetchTrendingSuggestions = async () => {
    try {
      setTrendingLoading(true);
      setTrendingError('');
      const params = {};
      if (trendingCategory) params.category = trendingCategory;
      const res = await productsAPI.getTrendingSuggestions(params);
      setTrendingResults(res.data.suggestions || []);
    } catch (err) {
      setTrendingError(err.response?.data?.message || 'Could not fetch suggestions right now');
    } finally {
      setTrendingLoading(false);
    }
  };

  const openTrending = () => {
    setShowTrending(true);
    if (trendingResults.length === 0) fetchTrendingSuggestions();
  };

  const applySuggestion = (suggestion) => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      name: suggestion.name || '',
      description: suggestion.description || '',
      category: suggestion.category || '',
    });
    setActiveSection('basic');
    ca();
    setShowTrending(false);
    setShowModal(true);
  };

  /* ── Save ────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!va(form)) return;
    try {
      setSaving(true);
      const payload = {
        ...form,
        image_url: form.image_base64 || form.image_url,
      };
      delete payload.image_base64;
      editing
        ? await productsAPI.update(editing.id, payload)
        : await productsAPI.create(payload);
      setShowModal(false);
      fetchProducts();
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const modalSections = [
    { key: 'basic',   label: '📦 Basic' },
    { key: 'pricing', label: '💰 Pricing' },
    { key: 'stock',   label: '🏭 Stock' },
    { key: 'media',   label: '🖼️ Media' },
    { key: 'extra',   label: '⭐ Extra' },
  ];

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{total} products in inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>⬇ Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>📥 Template</button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current.click()} disabled={importing}>
            {importing ? '⏳ Importing…' : '📤 Import CSV'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-secondary btn-sm" onClick={openTrending}>✨ Trending Ideas</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span>✅ {importResult.message}{importResult.errors?.length > 0 && ` — ${importResult.errors.length} errors`}</span>
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="🔍 Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select className="form-input" style={{ width: 'auto', minWidth: '140px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', minWidth: '140px' }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
            <option value="">All stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterCat || filterStock) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterCat(''); setFilterStock(''); }}>Clear</button>
          )}
          <span className="pagination-info">{total} results</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong>{selected.length} selected</strong>
          <button className="btn btn-success btn-sm" onClick={handleBulkDeal}>🔥 Mark as Deal</button>
          {isSuperAdmin && <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>🗑 Delete Selected</button>}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected([])}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading products…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No products found</h3>
            <p>{search || filterCat || filterStock ? 'No products match your filters.' : 'Add products manually or import from CSV.'}</p>
            {!search && !filterCat && !filterStock && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={downloadTemplate}>📥 Get Template</button>
                <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        style={{ accentColor: 'var(--accent)' }}
                        checked={selected.length === products.length && products.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Product <SortIcon col="name" />
                    </th>
                    <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Category <SortIcon col="category" />
                    </th>
                    <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Price <SortIcon col="price" />
                    </th>
                    <th>Margin</th>
                    <th>Discount</th>
                    <th onClick={() => handleSort('stock_quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Stock <SortIcon col="stock_quantity" />
                    </th>
                    <th>Status</th>
                    <th>Deal</th>
                    <th>Badge</th>
                    <th>Rating</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => {
                    const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));
                    return (
                      <tr
                        key={product.id}
                        style={{
                          opacity: product.is_active === false ? 0.5 : 1,
                          background: selected.includes(product.id) ? 'rgba(34,197,94,0.05)' : undefined,
                        }}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            style={{ accentColor: 'var(--accent)' }}
                            checked={selected.includes(product.id)}
                            onChange={() => toggleSelect(product.id)}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {(product.image_url) ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                                onError={e => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '6px',
                                background: '#f1f5f9', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '16px', flexShrink: 0,
                              }}>📦</div>
                            )}
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px' }}>{product.name}</div>
                              {product.sku && (
                                <div style={{ fontSize: '10.5px', color: 'var(--blue, #3b82f6)', fontFamily: 'monospace' }}>{product.sku}</div>
                              )}
                              {product.description && (
                                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                                  {product.description.substring(0, 40)}{product.description.length > 40 ? '…' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{product.category || '—'}</td>
                        <td style={{ fontWeight: '700' }}>GH₵ {parseFloat(product.price || 0).toFixed(2)}</td>
                        <td>
                          {product.cost_price ? (() => {
                            const profit = parseFloat(product.price || 0) - parseFloat(product.cost_price);
                            const marginPct = product.price > 0 ? Math.round((profit / parseFloat(product.price)) * 100) : 0;
                            return (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                                GH₵{profit.toFixed(2)} ({marginPct}%)
                              </span>
                            );
                          })() : (
                            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic' }}>Add cost</span>
                          )}
                        </td>
                        <td>{discount ? <span className="badge badge-red">-{discount}%</span> : '—'}</td>
                        <td>
                          {/* Quick stock adjust */}
                          {adjustingId === product.id ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                value={adjustQty}
                                onChange={e => setAdjustQty(e.target.value)}
                                style={{ width: '60px', padding: '4px 6px', fontSize: '12px' }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleManualAdjust(product); if (e.key === 'Escape') { setAdjustingId(null); setAdjustQty(''); }}}
                              />
                              <button className="btn btn-success btn-sm" style={{ padding: '4px 6px', fontSize: '11px' }} onClick={() => handleManualAdjust(product)}>✓</button>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '4px 6px', fontSize: '11px' }} onClick={() => { setAdjustingId(null); setAdjustQty(''); }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                                onClick={() => handleQuickAdjust(product, -1)}
                              >−</button>
                              <span
                                style={{ fontWeight: '600', cursor: 'pointer', minWidth: '24px', textAlign: 'center' }}
                                onClick={() => { setAdjustingId(product.id); setAdjustQty(product.stock_quantity); }}
                                title="Click to set exact quantity"
                              >
                                {product.stock_quantity}
                              </span>
                              <button
                                style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                                onClick={() => handleQuickAdjust(product, 1)}
                              >+</button>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stockDotColor(product.stock_quantity, product.low_stock_threshold), display: 'inline-block', flexShrink: 0 }} />
                            </div>
                          )}
                        </td>
                        <td><StockBadge product={product} /></td>
                        <td>
                          {product.is_deal
                            ? <span className="badge badge-green">🔥 Deal</span>
                            : <span className="badge badge-gray">No</span>}
                        </td>
                        <td>
                          {product.badge
                            ? <span className="badge badge-blue">{product.badge}</span>
                            : '—'}
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {product.rating > 0
                            ? `⭐ ${parseFloat(product.rating).toFixed(1)} (${product.review_count})`
                            : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(product)} title="Edit">✏️</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(product)} title="Duplicate">⧉</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => openHistory(product)} title="Stock history">📋</button>
                            <button
                              className={`btn btn-sm ${product.is_active !== false ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => handleToggleActive(product)}
                              title={product.is_active !== false ? 'Deactivate' : 'Activate'}
                              style={{ fontSize: '11px', padding: '4px 6px' }}
                            >
                              {product.is_active !== false ? '⊘' : '✓'}
                            </button>
                            {isSuperAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)} title="Delete">🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination" style={{ marginTop: '16px' }}>
                <span className="pagination-info">Page {page} of {pages} · {total} products</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Add / Edit Modal
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? `Edit — ${editing.name}` : 'Add Product'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="tabs" style={{ marginBottom: '20px' }}>
              {modalSections.map(s => (
                <button key={s.key} className={`tab-btn${activeSection === s.key ? ' active' : ''}`} onClick={() => setActiveSection(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Basic */}
            {activeSection === 'basic' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    style={inputStyle(fe.name)}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); ce('name'); }}
                    placeholder="e.g. iPhone 16 Pro Max"
                  />
                  <FormError error={fe.name} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short product description…" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      className="form-input"
                      value={form.category}
                      onChange={e => {
                        const category = e.target.value;
                        setForm(f => {
                          // Auto-suggest a SKU the moment a category is
                          // picked on a NEW product — never overwrites one
                          // that's already there (own or previously typed),
                          // since this is a starting point, not a rule.
                          if (f.sku || editing) return { ...f, category };
                          const prefix = category.slice(0, 3).toUpperCase();
                          if (!prefix) return { ...f, category };
                          const existingCount = products.filter(p => p.sku?.startsWith(prefix)).length;
                          const suggested = `${prefix}-${String(existingCount + 1).padStart(4, '0')}`;
                          return { ...f, category, sku: suggested };
                        });
                      }}
                      placeholder="e.g. Electronics"
                      list="cat-list"
                    />
                    <datalist id="cat-list">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Badge</label>
                    <select className="form-input" value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}>
                      <option value="">No badge</option>
                      <option value="Best Seller">Best Seller</option>
                      <option value="New">New</option>
                      <option value="Hot Deal">Hot Deal</option>
                      <option value="Limited">Limited</option>
                      <option value="Top Rated">Top Rated</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input
                      className="form-input"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder="Auto-suggested from category"
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>Suggested when you pick a category — edit freely</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="form-input"
                        value={form.barcode}
                        onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                        placeholder="Scan or generate one"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          // 13-digit numeric code — matches standard EAN-13
                          // length, so any barcode printer/scanner setup
                          // expecting that format works without translation.
                          const code = String(Date.now()).slice(-13).padStart(13, '0');
                          setForm(f => ({ ...f, barcode: code }));
                        }}
                      >
                        Generate
                      </button>
                    </div>
                    {form.barcode && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', textAlign: 'center' }}>
                        <BarcodePreview value={form.barcode} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                    <span className="form-label" style={{ margin: 0 }}>Active — visible on storefront</span>
                  </label>
                </div>
              </div>
            )}

            {/* Pricing */}
            {activeSection === 'pricing' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Cost Price (GH₵)</label>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      value={form.cost_price}
                      onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                      placeholder="What you paid for this"
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>Purchase/landed cost — never shown to customers</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (GH₵) *</label>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      value={form.price}
                      style={inputStyle(fe.price)}
                      onChange={e => { setForm(f => ({ ...f, price: e.target.value })); ce('price'); }}
                      placeholder="0.00"
                    />
                    <FormError error={fe.price} />
                  </div>
                </div>
                {form.cost_price && form.price && (() => {
                  const cost = parseFloat(form.cost_price);
                  const sell = parseFloat(form.price);
                  const profit = sell - cost;
                  const marginPct = sell > 0 ? Math.round((profit / sell) * 100) : 0;
                  return (
                    <div className={`alert ${profit >= 0 ? 'alert-success' : 'alert-danger'}`} style={{ fontSize: '13px' }}>
                      {profit >= 0 ? '💰' : '⚠️'} Profit: GH₵{profit.toFixed(2)} per unit ({marginPct}% margin)
                      {profit < 0 && ' — this is priced below cost'}
                    </div>
                  );
                })()}
                <div className="form-group">
                  <label className="form-label">Compare Price (GH₵)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.compare_price} onChange={e => setForm(f => ({ ...f, compare_price: e.target.value }))} placeholder="Original price" />
                </div>
                {form.compare_price && form.price && parseFloat(form.compare_price) > parseFloat(form.price) && (
                  <div className="alert alert-info" style={{ fontSize: '13px' }}>
                    💡 {Math.round((1 - parseFloat(form.price) / parseFloat(form.compare_price)) * 100)}% discount — customers will see this on the storefront
                  </div>
                )}
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_deal} onChange={e => setForm(f => ({ ...f, is_deal: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                    <span className="form-label" style={{ margin: 0 }}>🔥 Mark as Deal of the Day</span>
                  </label>
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>Deal products appear in the "Deals" section on the storefront</p>
                </div>
              </div>
            )}

            {/* Stock */}
            {activeSection === 'stock' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Quantity</label>
                    <input className="form-input" type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Alert Threshold</label>
                    <input className="form-input" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} placeholder="5" />
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>Alert shown when stock falls below this number</p>
                  </div>
                </div>
              </div>
            )}

            {/* Media */}
            {activeSection === 'media' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Product Image</label>

                  {/* Preview */}
                  {(form.image_base64 || form.image_url) && (
                    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                      <img
                        src={form.image_base64 || form.image_url}
                        alt="Product"
                        style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  )}

                  {/* Upload */}
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: '12px' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>🖼️</div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px', fontSize: '13px' }}>
                      {form.image_base64 ? 'Click to change image' : 'Upload product image'}
                    </p>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: 0 }}>JPG or PNG · Max 2MB</p>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handlePhotoUpload} />

                  <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 6px', textAlign: 'center' }}>— or paste an image URL —</p>
                  <input
                    className="form-input"
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value, image_base64: '' }))}
                    placeholder="https://example.com/image.jpg"
                  />
                  {(form.image_base64 || form.image_url) && (
                    <button className="btn btn-danger btn-sm" style={{ marginTop: '8px' }} onClick={() => setForm(f => ({ ...f, image_url: '', image_base64: '' }))}>Remove image</button>
                  )}
                </div>
              </div>
            )}

            {/* Extra */}
            {activeSection === 'extra' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Rating (0–5)</label>
                    <input className="form-input" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} placeholder="e.g. 4.5" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Review Count</label>
                    <input className="form-input" type="number" min="0" value={form.review_count} onChange={e => setForm(f => ({ ...f, review_count: e.target.value }))} placeholder="e.g. 128" />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
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
        <div className="modal-overlay" onClick={() => setHistoryProduct(null)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Stock History — {historyProduct.name}</h2>
              <button className="modal-close" onClick={() => setHistoryProduct(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="stat-card" style={{ flex: 1 }}>
                <p className="stat-label">Current Stock</p>
                <p className="stat-value" style={{ color: stockDotColor(historyProduct.stock_quantity, historyProduct.low_stock_threshold) }}>
                  {historyProduct.stock_quantity}
                </p>
              </div>
              <div className="stat-card" style={{ flex: 1 }}>
                <p className="stat-label">Alert At</p>
                <p className="stat-value" style={{ color: 'var(--text-2)' }}>{historyProduct.low_stock_threshold}</p>
              </div>
            </div>
            {loadingHistory ? (
              <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading history…</span></div>
            ) : stockHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No history yet</h3>
                <p>Stock movements will appear here</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Type</th><th>Change</th><th>Notes</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {stockHistory.map((m, i) => (
                      <tr key={i}>
                        <td><span className={`badge ${m.quantity > 0 ? 'badge-green' : 'badge-red'}`}>{m.type}</span></td>
                        <td style={{ fontWeight: '700', color: m.quantity > 0 ? 'var(--accent)' : '#ef4444' }}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{m.notes || '—'}</td>
                        <td style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          AI Trending Product Suggestions
      ══════════════════════════════════════════════════════════ */}
      {showTrending && (
        <div className="modal-overlay" onClick={() => setShowTrending(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">✨ Trending Product Ideas</h2>
              <button className="modal-close" onClick={() => setShowTrending(false)}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 14px' }}>
              AI-researched, based on current web results — not a guarantee of sales, just a starting point.
              Review before adding.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={trendingCategory}
                onChange={e => setTrendingCategory(e.target.value)}
                placeholder="Optional: narrow to a category, e.g. Electronics"
                onKeyDown={e => e.key === 'Enter' && fetchTrendingSuggestions()}
              />
              <button className="btn btn-primary" onClick={fetchTrendingSuggestions} disabled={trendingLoading}>
                {trendingLoading ? 'Searching…' : '🔍 Search'}
              </button>
            </div>

            {trendingLoading ? (
              <div className="loading"><div className="loading-spinner" /><span className="loading-text">Researching trending products…</span></div>
            ) : trendingError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>Couldn't fetch suggestions</h3>
                <p>{trendingError}</p>
                <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={fetchTrendingSuggestions}>Try again</button>
              </div>
            ) : trendingResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <h3>No suggestions yet</h3>
                <p>Click Search to get AI-researched trending product ideas</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '55vh', overflowY: 'auto' }}>
                {trendingResults.map((s, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                      <div>
                        <p style={{ fontWeight: '700', margin: '0 0 2px' }}>{s.name}</p>
                        {s.category && <span className="badge badge-blue" style={{ marginBottom: '6px', display: 'inline-block' }}>{s.category}</span>}
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => applySuggestion(s)} style={{ whiteSpace: 'nowrap' }}>
                        Use this
                      </button>
                    </div>
                    {s.description && <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '6px 0' }}>{s.description}</p>}
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-3)' }}>
                      {s.suggested_price_range && <span>💰 {s.suggested_price_range}</span>}
                      {s.why_trending && <span>📈 {s.why_trending}</span>}
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
};

export default Products;
