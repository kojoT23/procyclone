import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, productsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };

const typeBadge = (type) => {
  const map = {
    sale: { bg: '#eff6ff', color: '#1d4ed8', label: 'Sale' },
    purchase: { bg: '#f0fdf4', color: '#16a34a', label: 'Purchase' },
    return: { bg: '#faf5ff', color: '#7c3aed', label: 'Return' },
    adjustment: { bg: '#fffbeb', color: '#d97706', label: 'Adjustment' },
    damage: { bg: '#fef2f2', color: '#ef4444', label: 'Damage/Loss' },
  };
  return map[type] || { bg: '#f3f4f6', color: '#6b7280', label: type };
};

const TransportInventory = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('activity'); // 'activity' | 'report'
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [reportProductId, setReportProductId] = useState('');
  const [reportType, setReportType] = useState('damage');
  const [reportQty, setReportQty] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryAPI.getMovements({ created_by: user?.id, limit: 30 });
      setMovements(res.data.movements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    if (tab === 'report' && products.length === 0) {
      productsAPI.getAll({ limit: 200 }).then(res => setProducts(res.data.products || [])).catch(console.error);
    }
  }, [tab, products.length]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const submitReport = async () => {
    if (!reportProductId || !reportQty) return alert('Select a product and quantity');
    setSubmitting(true);
    try {
      await inventoryAPI.adjustStock({
        product_id: parseInt(reportProductId),
        type: reportType,
        quantity: parseInt(reportQty),
        notes: reportNotes || undefined,
      });
      showToast('Report submitted');
      setReportProductId(''); setReportQty(''); setReportNotes('');
      setTab('activity');
      fetchActivity();
    } catch (err) {
      alert('Could not submit report: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Inventory</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ v: 'activity', l: 'My Activity' }, { v: 'report', l: 'Report Damage/Loss' }].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: tab === t.v ? '1px solid #22c55e' : '1px solid #e5e7eb',
              background: tab === t.v ? '#f0fdf4' : '#fff',
              color: tab === t.v ? '#16a34a' : '#6b7280',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          ✓ {toast}
        </div>
      )}

      {tab === 'activity' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
        ) : movements.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>No stock activity yet</div>
        ) : (
          movements.map(m => {
            const badge = typeBadge(m.type);
            return (
              <div key={m.id} style={{ ...card, marginBottom: 10, padding: '13px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{m.product_name || m.product?.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date(m.created_at).toLocaleString()}</div>
                    {m.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{m.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a18', marginTop: 6 }}>
                      {m.type === 'sale' ? '−' : '+'}{Math.abs(m.quantity)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )
      )}

      {tab === 'report' && (
        <div style={card}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Product</span>
          <select style={{ ...input, marginBottom: 12 }} value={reportProductId} onChange={e => setReportProductId(e.target.value)}>
            <option value="">Select a product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Reason</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ v: 'damage', l: 'Damaged' }, { v: 'adjustment', l: 'Lost / Missing' }].map(opt => (
              <button key={opt.v} onClick={() => setReportType(opt.v)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: reportType === opt.v ? '1px solid #ef4444' : '1px solid #e5e7eb',
                  background: reportType === opt.v ? '#fef2f2' : '#fff',
                  color: reportType === opt.v ? '#ef4444' : '#6b7280',
                }}>
                {opt.l}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Quantity</span>
          <input style={{ ...input, marginBottom: 12 }} type="number" min="1" placeholder="How many units" value={reportQty} onChange={e => setReportQty(e.target.value)} />

          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' }}>Notes</span>
          <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} placeholder="What happened? (optional but recommended)" value={reportNotes} onChange={e => setReportNotes(e.target.value)} />

          <button onClick={submitReport} disabled={submitting}
            style={{ width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 12, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TransportInventory;
