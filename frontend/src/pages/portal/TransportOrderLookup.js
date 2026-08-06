import React, { useState, useCallback } from 'react';
import { ordersAPI } from '../../utils/api';
import { ReceiptDocument } from '../Receipts'; // side-effect: also loads Receipts.css

const fmt = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);
const card = { background: '#fff', borderRadius: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };
const input = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };

const STATUS = {
  pending:          { label: 'Pending',          color: '#f59e0b', bg: '#fffbeb' },
  confirmed:        { label: 'Confirmed',        color: '#3b82f6', bg: '#eff6ff' },
  packing:          { label: 'Packing',          color: '#8b5cf6', bg: '#f5f3ff' },
  assigned:         { label: 'Assigned',         color: '#14b8a6', bg: '#f0fdfa' },
  processing:       { label: 'Picked Up',        color: '#0891b2', bg: '#ecfeff' },
  out_for_delivery: { label: 'Out for Delivery', color: '#f97316', bg: '#fff7ed' },
  delivered:        { label: 'Delivered',        color: '#22c55e', bg: '#f0fdf4' },
  failed:           { label: 'Failed',           color: '#ef4444', bg: '#fef2f2' },
  returned:         { label: 'Returned',         color: '#ef4444', bg: '#fef2f2' },
  cancelled:        { label: 'Cancelled',        color: '#6b7280', bg: '#f3f4f6' },
};

const TransportOrderLookup = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({}); // orderId -> full order with items
  const [detailLoading, setDetailLoading] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await ordersAPI.getAll({ search: query.trim(), limit: 30 });
      setResults(res.data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const toggleExpand = async (order) => {
    if (expandedId === order.id) { setExpandedId(null); return; }
    setExpandedId(order.id);
    if (!detailCache[order.id]) {
      setDetailLoading(order.id);
      try {
        const res = await ordersAPI.getOne(order.id);
        setDetailCache(prev => ({ ...prev, [order.id]: res.data.order }));
      } catch (err) {
        console.error(err);
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const handleCancel = async (order) => {
    const reason = window.prompt(`Cancel order ${order.order_number}? Add a reason (optional):`);
    if (reason === null) return; // user hit Cancel on the prompt itself
    setCancellingId(order.id);
    try {
      const res = await ordersAPI.cancel(order.id, { reason });
      setResults(prev => prev.map(o => o.id === order.id ? { ...o, status: res.data.order.status } : o));
      setDetailCache(prev => { const n = { ...prev }; delete n[order.id]; return n; });
    } catch (err) {
      alert(err.response?.data?.message || 'Could not cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrint = async (orderId) => {
    setPrintingId(orderId);
    try {
      const full = detailCache[orderId] || (await ordersAPI.getOne(orderId)).data.order;
      setPrintOrder(full);
      setTimeout(() => window.print(), 400);
    } catch (err) {
      alert('Could not load receipt');
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>Find an Order</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={input}
          placeholder="Customer name, phone, or order number…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
        />
        <button onClick={runSearch} disabled={!query.trim() || loading}
          style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!query.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {!searched && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 16px', fontSize: 13 }}>
          Search any order in the system — not just ones you created.<br />
          Useful when a customer calls about a sale another agent handled.
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
          No orders found for "{query}"
        </div>
      )}

      {results.map(order => {
        const st = STATUS[order.status] || STATUS.pending;
        const isExpanded = expandedId === order.id;
        const detail = detailCache[order.id];

        return (
          <div key={order.id} style={{ ...card, borderLeft: `4px solid ${st.color}` }}>
            <div onClick={() => toggleExpand(order)} style={{ padding: '13px 16px', cursor: 'pointer', background: isExpanded ? st.bg : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{order.order_number}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginTop: 3 }}>{order.customer_name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{order.customer_phone}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1a1a18' }}>{fmt(order.total_amount)}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '0 16px 14px' }}>
                {detailLoading === order.id ? (
                  <div style={{ padding: '10px 0', color: '#9ca3af', fontSize: 12 }}>Loading details…</div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Delivery Address</span>
                      <p style={{ margin: '3px 0 0', fontWeight: 600, color: '#1a1a18' }}>📍 {order.delivery_address || '—'}</p>
                    </div>

                    {detail?.items && (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Items</span>
                        {detail.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', color: '#1a1a18' }}>
                            <span>{item.quantity}× {item.product_name}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(item.total_price || item.quantity * item.unit_price)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {order.status === 'delivered' && (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Delivery Proof</span>
                        {detail?.proof_photo ? (
                          <img src={detail.proof_photo} alt="Delivery proof" style={{ width: '100%', borderRadius: 10, marginTop: 6 }} />
                        ) : detail ? (
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>No photo was captured for this delivery.</p>
                        ) : null}
                        {detail?.recipient_name && (
                          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1a1a18' }}><strong>Received by:</strong> {detail.recipient_name}</p>
                        )}
                        {detail?.delivery_notes && (
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{detail.delivery_notes}</p>
                        )}
                      </div>
                    )}

                    {order.rider_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f0fdfa', borderRadius: 8, marginBottom: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#14b8a6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          {order.rider_name.charAt(0)}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{order.rider_name} (rider)</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{order.rider_phone}</p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {order.customer_phone && (
                        <a href={`tel:${order.customer_phone}`} style={{ ...btnStyle, background: '#f3f4f6', color: '#1a1a18', textDecoration: 'none' }}>
                          📞 Call Customer
                        </a>
                      )}
                      {order.rider_phone && (
                        <a href={`tel:${order.rider_phone}`} style={{ ...btnStyle, background: '#f3f4f6', color: '#1a1a18', textDecoration: 'none' }}>
                          📞 Call Rider
                        </a>
                      )}
                      <button onClick={() => handlePrint(order.id)} disabled={printingId === order.id}
                        style={{ ...btnStyle, background: '#fff', color: '#1a1a18', border: '1px solid #e5e7eb', opacity: printingId === order.id ? 0.6 : 1 }}>
                        {printingId === order.id ? 'Preparing…' : '🖨️ Receipt'}
                      </button>
                      {order.status === 'pending' && (
                        <button onClick={() => handleCancel(order)} disabled={cancellingId === order.id}
                          style={{ ...btnStyle, background: '#fef2f2', color: '#ef4444', opacity: cancellingId === order.id ? 0.6 : 1 }}>
                          {cancellingId === order.id ? 'Cancelling…' : '✕ Cancel Order'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {printOrder && (
        <div className="print-only">
          <ReceiptDocument order={printOrder} />
        </div>
      )}
    </div>
  );
};

const btnStyle = { padding: '9px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-block' };

export default TransportOrderLookup;
