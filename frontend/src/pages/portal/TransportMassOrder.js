import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, ordersAPI, ridersAPI, schedulerAPI } from '../../utils/api';

const formatCurrency = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const label = { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const errText = { color: '#ef4444', fontSize: 12, marginTop: 4 };
const qtyBtn = { width: 26, height: 26, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#1a1a18' };

const TransportMassOrder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  /* ── Round builder state — resets after "Add Round to Cart" ── */
  const [customerSearch, setCustomerSearch] = useState('');
  const [roundCustomerIds, setRoundCustomerIds] = useState(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [roundItems, setRoundItems] = useState([]); // [{product_id, name, price, stock, defaultQty}]
  const [roundQty, setRoundQty] = useState({}); // { [customerId]: { [productId]: qty } }
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  /* ── Persistent cart — accumulated across rounds, one entry per customer ── */
  const [cart, setCart] = useState({}); // { [customerId]: { customer, items: { [productId]: {...,quantity} } } }

  /* ── Review / apply ── */
  const [showReview, setShowReview] = useState(false);
  const [addresses, setAddresses] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [momoReference, setMomoReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const lastSubmitSignature = useRef(null);

  /* ── Assign-all-to-a-rider, right after Apply — saves the trip to
     Schedule and re-picking every order one by one there. ── */
  const [riders, setRiders] = useState([]);
  const [assignRiderId, setAssignRiderId] = useState('');
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignProgress, setAssignProgress] = useState(null);
  const [assignResults, setAssignResults] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [c, p, r] = await Promise.all([
        customersAPI.getAll({ limit: 500 }),
        productsAPI.getAll({ limit: 200 }),
        ridersAPI.getAll(),
      ]);
      setCustomers(c.data.customers || []);
      setProducts((p.data.products || []).filter(pr => pr.is_active && pr.stock_quantity > 0));
      // Same convention as TransportSchedule.js — assignment goes through
      // r.user_id (scheduled_tasks.assigned_to references users, not
      // riders), and riders with no linked login can't be assigned to.
      setRiders((r.data.riders || []).filter(rd => rd.user_id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Assigns every order just created in this batch to one rider, looping
  // the same schedulerAPI.create call Schedule's own Add Task uses — one
  // request per order, independently, so a single failure (e.g. unverified
  // MoMo payment) doesn't block the rest from being assigned.
  const assignAllToRider = async () => {
    if (!assignRiderId || !results?.orders?.length) return;
    setAssigning(true);
    const failures = [];
    setAssignProgress({ done: 0, total: results.orders.length });
    for (let i = 0; i < results.orders.length; i++) {
      const order = results.orders[i];
      try {
        await schedulerAPI.create({ assigned_to: assignRiderId, task_date: assignDate, type: 'order', order_id: order.id });
      } catch (err) {
        const msg = err.response?.data?.code === 'PAYMENT_NOT_VERIFIED' ? 'MoMo payment needs verification' : (err.response?.data?.message || 'Could not assign');
        failures.push(`${order.order_number}: ${msg}`);
      }
      setAssignProgress({ done: i + 1, total: results.orders.length });
    }
    setAssigning(false);
    setAssignResults({ assigned: results.orders.length - failures.length, failed: failures });
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    return customers.filter(c =>
      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8);
  }, [products, productSearch]);

  const toggleRoundCustomer = (customer) => {
    setRoundCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(customer.id)) next.delete(customer.id);
      else next.add(customer.id);
      return next;
    });
    setCustomerSearch('');
  };

  const addRoundItem = (product) => {
    setProductSearch('');
    setRoundItems(prev => {
      if (prev.find(i => i.product_id === product.id)) return prev;
      return [...prev, { product_id: product.id, name: product.name, price: parseFloat(product.price), stock: product.stock_quantity, defaultQty: 1 }];
    });
  };
  const changeDefaultQty = (productId, delta) => {
    setRoundItems(prev => prev.map(i => i.product_id === productId ? { ...i, defaultQty: Math.max(1, i.defaultQty + delta) } : i));
  };
  const removeRoundItem = (productId) => setRoundItems(prev => prev.filter(i => i.product_id !== productId));

  const qtyFor = (customerId, productId) => {
    const explicit = roundQty[customerId]?.[productId];
    if (explicit !== undefined) return explicit;
    return roundItems.find(i => i.product_id === productId)?.defaultQty || 1;
  };
  const bumpQtyFor = (customerId, productId, delta) => {
    setRoundQty(prev => {
      const current = qtyFor(customerId, productId);
      return { ...prev, [customerId]: { ...prev[customerId], [productId]: Math.max(0, current + delta) } };
    });
  };

  const roundReady = roundCustomerIds.size > 0 && roundItems.length > 0;

  const commitRound = () => {
    if (!roundReady) return;
    setCart(prevCart => {
      const next = { ...prevCart };
      roundCustomerIds.forEach(cid => {
        const customer = customers.find(c => c.id === cid);
        if (!next[cid]) next[cid] = { customer, items: {} };
        roundItems.forEach(ri => {
          const qty = qtyFor(cid, ri.product_id);
          if (qty <= 0) return;
          const existingQty = next[cid].items[ri.product_id]?.quantity || 0;
          next[cid] = {
            ...next[cid],
            items: { ...next[cid].items, [ri.product_id]: { product_id: ri.product_id, name: ri.name, unit_price: ri.price, quantity: existingQty + qty } },
          };
        });
      });
      return next;
    });
    setRoundCustomerIds(new Set());
    setRoundItems([]);
    setRoundQty({});
    setExpandedCustomerId(null);
  };

  const cartCustomerIds = Object.keys(cart);
  const customerSubtotal = (entry) => Object.values(entry.items).reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const cartTotal = cartCustomerIds.reduce((sum, cid) => sum + customerSubtotal(cart[cid]), 0);

  const removeCustomerFromCart = (cid) => setCart(prev => { const n = { ...prev }; delete n[cid]; return n; });
  const removeItemFromCustomer = (cid, pid) => setCart(prev => {
    const items = { ...prev[cid].items };
    delete items[pid];
    if (Object.keys(items).length === 0) { const n = { ...prev }; delete n[cid]; return n; }
    return { ...prev, [cid]: { ...prev[cid], items } };
  });

  const openReview = () => {
    setAddresses(prev => {
      const next = { ...prev };
      cartCustomerIds.forEach(cid => { if (!next[cid]) next[cid] = cart[cid].customer?.address || ''; });
      return next;
    });
    setResults(null);
    setShowReview(true);
  };

  const buildSignature = () => JSON.stringify({
    customers: cartCustomerIds.sort(),
    items: cartCustomerIds.map(cid => Object.values(cart[cid].items).map(i => `${i.product_id}:${i.quantity}`).sort()),
    paymentMethod,
  });

  const handleApply = async () => {
    const missing = cartCustomerIds.find(cid => !addresses[cid]?.trim());
    if (missing) { alert(`${cart[missing].customer?.name} is missing a delivery address.`); return; }
    if (paymentMethod === 'momo' && !momoReference.trim()) { alert('Enter a MoMo reference for this batch.'); return; }

    const signature = buildSignature();
    const last = lastSubmitSignature.current;
    if (last && last.signature === signature && Date.now() - last.at < 2 * 60 * 1000) {
      if (!window.confirm('This looks like the same batch you just submitted. Submit again anyway?')) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orders: cartCustomerIds.map(cid => ({
          customer_id: cid,
          items: Object.values(cart[cid].items).map(it => ({ product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price })),
          payment_method: paymentMethod === 'paid_on_delivery' ? 'cod' : paymentMethod,
          delivery_address: addresses[cid],
          notes: notes || '',
          ...(momoReference ? { momo_reference: momoReference } : {}),
        })),
      };
      lastSubmitSignature.current = { signature, at: Date.now() };
      const res = await ordersAPI.createBulk(payload);
      setResults(res.data);
      setAssignResults(null);
      setAssignRiderId('');
      if (res.data.created_count > 0) {
        const failedIds = new Set((res.data.errors || []).map(e => String(e.customer_id)));
        setCart(prev => {
          const next = {};
          Object.keys(prev).forEach(cid => { if (failedIds.has(String(cid))) next[cid] = prev[cid]; });
          return next;
        });
      }
    } catch (err) {
      alert('Error applying mass order: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 16px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: 0 }}>Mass Order</h1>
        <button onClick={() => navigate('/transport/billing')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Single sale instead →
        </button>
      </div>

      {results && (
        <div style={{ ...card, border: results.failed_count > 0 ? '1px solid #fde68a' : '1px solid #bbf7d0', background: results.failed_count > 0 ? '#fffbeb' : '#f0fdf4' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{results.created_count} order{results.created_count !== 1 ? 's' : ''} created</div>
          {results.failed_count > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{results.failed_count} failed — still in cart to fix:</div>
              {results.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
                  {customers.find(c => c.id === parseInt(e.customer_id))?.name || `Customer ${e.customer_id}`}: {e.message}
                </div>
              ))}
            </div>
          )}
          {results.created_count > 0 && !assignResults && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>Assign all {results.created_count} to a rider now?</div>
              <select value={assignRiderId} onChange={e => setAssignRiderId(e.target.value)} style={{ ...input, marginBottom: 8 }}>
                <option value="">Select rider…</option>
                {riders.map(r => <option key={r.id} value={r.user_id}>{r.name}{r.is_available === false ? ' (busy)' : ''}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} style={{ ...input, flex: 1 }} />
                <button onClick={assignAllToRider} disabled={!assignRiderId || assigning}
                  style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!assignRiderId || assigning) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {assigning ? `${assignProgress?.done || 0}/${assignProgress?.total || 0}…` : 'Assign All'}
                </button>
              </div>
              <button onClick={() => navigate('/transport/schedule')} style={{ marginTop: 8, background: 'none', border: 'none', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                or assign individually in Schedule →
              </button>
            </div>
          )}
          {assignResults && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>✓ {assignResults.assigned} order{assignResults.assigned !== 1 ? 's' : ''} assigned to {riders.find(r => String(r.user_id) === String(assignRiderId))?.name}</div>
              {assignResults.failed.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{assignResults.failed.length} couldn't be assigned:</div>
                  {assignResults.failed.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>{f}</div>)}
                  <button onClick={() => navigate('/transport/schedule')} style={{ marginTop: 8, background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Resolve the rest in Schedule →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Round: customers */}
      <div style={card}>
        <span style={label}>Round — Select Customers</span>
        {roundCustomerIds.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {[...roundCustomerIds].map(cid => {
              const c = customers.find(x => x.id === cid);
              return (
                <span key={cid} onClick={() => toggleRoundCustomer(c)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}>
                  {c?.name} ✕
                </span>
              );
            })}
          </div>
        )}
        <input style={input} placeholder="Search by name or phone…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
        {filteredCustomers.map(c => (
          <div key={c.id} onClick={() => toggleRoundCustomer(c)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.phone}</div>
            </div>
            {roundCustomerIds.has(c.id) && <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>}
          </div>
        ))}
      </div>

      {/* Round: items */}
      <div style={card}>
        <span style={label}>Round — Add Items</span>
        <input style={input} placeholder="Search products to add…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
        {filteredProducts.map(p => (
          <div key={p.id} onClick={() => addRoundItem(p)} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.stock_quantity} in stock</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(p.price)}</div>
          </div>
        ))}
        {roundItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {roundItems.map(item => (
              <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{formatCurrency(item.price)} each · default qty</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => changeDefaultQty(item.product_id, -1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.defaultQty}</span>
                  <button onClick={() => changeDefaultQty(item.product_id, 1)} style={qtyBtn}>+</button>
                  <button onClick={() => removeRoundItem(item.product_id)} style={{ ...qtyBtn, color: '#ef4444', marginLeft: 4 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Round: per-customer quantity accordion */}
      {roundCustomerIds.size > 0 && roundItems.length > 0 && (
        <div style={card}>
          <span style={label}>Round — Adjust Per Customer <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></span>
          {[...roundCustomerIds].map(cid => {
            const c = customers.find(x => x.id === cid);
            const expanded = expandedCustomerId === cid;
            return (
              <div key={cid} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div onClick={() => setExpandedCustomerId(expanded ? null : cid)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c?.name}</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{expanded ? '▲ hide' : '▼ adjust'}</span>
                </div>
                {expanded && (
                  <div style={{ paddingBottom: 10 }}>
                    {roundItems.map(item => (
                      <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => bumpQtyFor(cid, item.product_id, -1)} style={qtyBtn}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{qtyFor(cid, item.product_id)}</span>
                          <button onClick={() => bumpQtyFor(cid, item.product_id, 1)} style={qtyBtn}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={commitRound}
        disabled={!roundReady}
        style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: roundReady ? '#22c55e' : '#e5e7eb', color: roundReady ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: roundReady ? 'pointer' : 'default', marginBottom: 14 }}
      >
        ✓ Add Round to Cart
      </button>

      {/* Persistent cart */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={label}>Cart — {cartCustomerIds.length} Customer{cartCustomerIds.length !== 1 ? 's' : ''}</span>
        </div>
        {cartCustomerIds.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 13 }}>No customers added yet</div>
        ) : (
          cartCustomerIds.map(cid => {
            const entry = cart[cid];
            return (
              <div key={cid} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{entry.customer?.name}</span>
                  <button onClick={() => removeCustomerFromCart(cid)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                </div>
                {Object.values(entry.items).map(it => (
                  <div key={it.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    <span>{it.name} × {it.quantity}</span>
                    <span>{formatCurrency(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  <span>Subtotal</span>
                  <span style={{ color: '#22c55e' }}>{formatCurrency(customerSubtotal(entry))}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: 'fixed', bottom: 62, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #f3f4f6',
        padding: '12px 16px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 90,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TOTAL · {cartCustomerIds.length} orders</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{formatCurrency(cartTotal)}</div>
        </div>
        <button onClick={openReview} disabled={cartCustomerIds.length === 0}
          style={{ padding: '13px 24px', borderRadius: 12, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: cartCustomerIds.length === 0 ? 0.4 : 1 }}>
          Review &amp; Apply
        </button>
      </div>

      {/* Review bottom sheet */}
      {showReview && (
        <div onClick={() => !submitting && setShowReview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '10px 16px 24px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '4px auto 14px' }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>Apply {cartCustomerIds.length} Orders</h2>

            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#1d4ed8', marginBottom: 14 }}>
              Payment method and notes apply to every order. Delivery address is per customer. Riders are assigned later from Schedule.
            </div>

            <span style={label}>Payment (all orders)</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[{ v: 'cash', l: '💵 Cash' }, { v: 'momo', l: '📱 MoMo' }, { v: 'paid_on_delivery', l: '🚪 On Delivery' }].map(opt => (
                <button key={opt.v} onClick={() => setPaymentMethod(opt.v)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: paymentMethod === opt.v ? '1px solid #22c55e' : '1px solid #e5e7eb', background: paymentMethod === opt.v ? '#f0fdf4' : '#fff', color: paymentMethod === opt.v ? '#16a34a' : '#6b7280' }}>
                  {opt.l}
                </button>
              ))}
            </div>
            {paymentMethod === 'momo' && (
              <input style={{ ...input, marginBottom: 14 }} placeholder="MoMo reference (all orders)" value={momoReference} onChange={e => setMomoReference(e.target.value)} />
            )}

            <span style={label}>Notes (optional, all orders)</span>
            <textarea style={{ ...input, minHeight: 50, resize: 'vertical', marginBottom: 14 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bulk order" />

            <span style={label}>Delivery Address — Per Customer</span>
            {cartCustomerIds.map(cid => (
              <div key={cid} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{cart[cid].customer?.name}</span>
                  <span style={{ color: '#9ca3af' }}>{formatCurrency(customerSubtotal(cart[cid]))}</span>
                </div>
                <input style={input} value={addresses[cid] || ''} onChange={e => setAddresses(prev => ({ ...prev, [cid]: e.target.value }))} placeholder="Delivery address" />
              </div>
            ))}

            <button onClick={handleApply} disabled={submitting}
              style={{ width: '100%', marginTop: 10, padding: '14px 0', borderRadius: 12, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Applying…' : `Apply Order — ${cartCustomerIds.length} Customers`}
            </button>
            <button onClick={() => setShowReview(false)} disabled={submitting}
              style={{ width: '100%', marginTop: 8, padding: '12px 0', background: '#f9f9f8', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
              Back to Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportMassOrder;
