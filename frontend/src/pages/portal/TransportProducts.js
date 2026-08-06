import React, { useState, useEffect, useMemo } from 'react';
import { productsAPI, restockAPI } from '../../utils/api';

const formatCurrency = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };

const stockBadge = (p) => {
  if (p.stock_quantity === 0) return { text: 'Out of stock', bg: '#fef2f2', color: '#ef4444' };
  if (p.stock_quantity <= p.low_stock_threshold) return { text: 'Low stock', bg: '#fffbeb', color: '#d97706' };
  return { text: 'In stock', bg: '#f0fdf4', color: '#16a34a' };
};

const TransportProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flagging, setFlagging] = useState(null); // product being flagged
  const [flagQty, setFlagQty] = useState('');
  const [flagNote, setFlagNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll({ limit: 200 });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const openFlag = (product) => {
    setFlagging(product);
    setFlagQty('');
    setFlagNote('');
  };

  const submitFlag = async () => {
    if (!flagging) return;
    setSubmitting(true);
    try {
      await restockAPI.request({
        product_id: flagging.id,
        quantity_needed: flagQty ? parseInt(flagQty) : null,
        note: flagNote || `Flagged low from Transport Portal — currently ${flagging.stock_quantity} in stock`,
      });
      showToast(`Restock request sent for ${flagging.name}`);
      setFlagging(null);
    } catch (err) {
      alert('Could not send restock request: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Stock</h1>

      <div style={{ marginBottom: 14 }}>
        <input style={input} placeholder="Search products or category…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {toast && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          ✓ {toast}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>No products found</div>
      )}

      {filtered.map(p => {
        const badge = stockBadge(p);
        return (
          <div key={p.id} style={{ ...card, marginBottom: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{p.name}</div>
                {p.category && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{p.category}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a18' }}>{formatCurrency(p.price)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
                    {badge.text}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{p.stock_quantity} units on hand</div>
              </div>
              {(p.stock_quantity === 0 || p.stock_quantity <= p.low_stock_threshold) && (
                <button onClick={() => openFlag(p)}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #f59e0b', background: '#fffbeb', color: '#d97706', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ⚠ Flag
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Flag / restock request modal */}
      {flagging && (
        <div onClick={() => setFlagging(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 28px' }}>
            <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a18', marginBottom: 4 }}>Request Restock</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{flagging.name} — currently {flagging.stock_quantity} in stock</div>
            <input style={{ ...input, marginBottom: 10 }} type="number" min="1" placeholder="Quantity needed (optional)" value={flagQty} onChange={e => setFlagQty(e.target.value)} />
            <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} placeholder="Note (optional)" value={flagNote} onChange={e => setFlagNote(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setFlagging(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitFlag} disabled={submitting} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportProducts;
