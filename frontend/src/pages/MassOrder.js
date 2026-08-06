import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, ordersAPI, deliveryZonesAPI, ridersAPI, schedulerAPI } from '../utils/api';
import './Billing.css';

const formatCurrency = (amount) => 'GHS ' + parseFloat(amount || 0).toFixed(2);

const MassOrder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);

  /* ── Cart: one entry per customer, accumulated across rounds ──────
     Keyed by customer id. Each customer's items are ALSO keyed by
     product id, so picking the same product for the same customer
     in a later round adds to the existing quantity instead of
     creating a duplicate line — matches "give them the same order
     again" naturally. */
  const [cart, setCart] = useState({}); // { [customerId]: { customer, items: { [productId]: {product_id,name,unit_price,quantity} } } }

  /* ── Round builder state — resets after each "Done" ──────────── */
  const [roundCustomerIds, setRoundCustomerIds] = useState(new Set());
  const [roundItems, setRoundItems] = useState([]); // [{ product_id, defaultQty }]
  const [roundQty, setRoundQty] = useState({}); // { [customerId]: { [productId]: qty } } — independent per customer
  const [customerSearch, setCustomerSearch] = useState('');

  /* ── Final apply step ──────────────────────────────────────── */
  const [showReview, setShowReview] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [momoReference, setMomoReference] = useState('');
  const [deliveryZoneId, setDeliveryZoneId] = useState('');
  const [notes, setNotes] = useState('');
  const [addresses, setAddresses] = useState({}); // per-customer override, defaults to customer.address
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { created_count, failed_count, errors }
  const lastSubmitSignature = useRef(null);

  /* ── Assign-all-to-a-rider, right after Apply ── */
  const [riders, setRiders] = useState([]);
  const [assignRiderId, setAssignRiderId] = useState('');
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignProgress, setAssignProgress] = useState(null);
  const [assignResults, setAssignResults] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [c, p, z, r] = await Promise.all([
        customersAPI.getAll({ limit: 500 }),
        productsAPI.getAll({ limit: 200 }),
        deliveryZonesAPI.getAll(),
        ridersAPI.getAll(),
      ]);
      setCustomers(c.data.customers || []);
      setProducts((p.data.products || []).filter(pr => pr.is_active && pr.stock_quantity > 0));
      setZones((z.data.zones || []).filter(zone => zone.is_active));
      // Same convention as Scheduler.js/TransportSchedule.js — assignment
      // goes through r.user_id (scheduled_tasks.assigned_to references
      // users, not riders), and riders with no linked login can't be
      // assigned to.
      setRiders((r.data.riders || []).filter(rd => rd.user_id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Assigns every order just created in this batch to one rider, looping
  // schedulerAPI.create once per order — the same call Scheduler's own
  // Add Task uses — so a single failure (e.g. unverified MoMo payment)
  // doesn't block the rest of the batch from being assigned.
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

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const cartCustomerIds = Object.keys(cart);
  const cartTotal = cartCustomerIds.reduce((sum, cid) => sum + customerSubtotal(cart[cid]), 0);

  function customerSubtotal(entry) {
    return Object.values(entry.items).reduce((s, it) => s + it.unit_price * it.quantity, 0);
  }

  /* ── Round builder actions ─────────────────────────────────── */
  const toggleRoundCustomer = (customer) => {
    setRoundCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(customer.id)) next.delete(customer.id);
      else next.add(customer.id);
      return next;
    });
  };

  const addRoundItem = () => setRoundItems([...roundItems, { product_id: '', defaultQty: 1 }]);
  const removeRoundItem = (idx) => setRoundItems(roundItems.filter((_, i) => i !== idx));
  const updateRoundItem = (idx, field, value) => {
    const updated = [...roundItems];
    updated[idx][field] = value;
    setRoundItems(updated);
  };

  const qtyFor = (customerId, productId) => {
    const explicit = roundQty[customerId]?.[productId];
    if (explicit !== undefined) return explicit;
    const item = roundItems.find(it => String(it.product_id) === String(productId));
    return item ? item.defaultQty : 1;
  };

  const setQtyFor = (customerId, productId, qty) => {
    setRoundQty(prev => ({
      ...prev,
      [customerId]: { ...prev[customerId], [productId]: qty },
    }));
  };

  const roundReady = roundCustomerIds.size > 0 && roundItems.length > 0 && roundItems.every(it => it.product_id);

  const commitRound = () => {
    if (!roundReady) return;
    setCart(prevCart => {
      const next = { ...prevCart };
      roundCustomerIds.forEach(cid => {
        const customer = customers.find(c => c.id === cid);
        if (!next[cid]) next[cid] = { customer, items: {} };
        roundItems.forEach(ri => {
          const product = products.find(p => p.id === parseInt(ri.product_id));
          if (!product) return;
          const qty = parseInt(qtyFor(cid, ri.product_id)) || 0;
          if (qty <= 0) return;
          const pid = product.id;
          const existingQty = next[cid].items[pid]?.quantity || 0;
          next[cid] = {
            ...next[cid],
            items: {
              ...next[cid].items,
              [pid]: {
                product_id: pid,
                name: product.name,
                unit_price: parseFloat(product.price),
                quantity: existingQty + qty,
              },
            },
          };
        });
      });
      return next;
    });
    // Reset round — ready for the next batch of customers/items
    setRoundCustomerIds(new Set());
    setRoundItems([]);
    setRoundQty({});
    setCustomerSearch('');
  };

  /* ── Cart editing ──────────────────────────────────────────── */
  const removeCustomerFromCart = (cid) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[cid];
      return next;
    });
  };

  const removeItemFromCustomer = (cid, pid) => {
    setCart(prev => {
      const entry = prev[cid];
      const items = { ...entry.items };
      delete items[pid];
      if (Object.keys(items).length === 0) {
        const next = { ...prev };
        delete next[cid];
        return next;
      }
      return { ...prev, [cid]: { ...entry, items } };
    });
  };

  const updateCartItemQty = (cid, pid, qty) => {
    setCart(prev => {
      const entry = prev[cid];
      const item = entry.items[pid];
      return {
        ...prev,
        [cid]: { ...entry, items: { ...entry.items, [pid]: { ...item, quantity: Math.max(1, parseInt(qty) || 1) } } },
      };
    });
  };

  /* ── Review / Apply ───────────────────────────────────────── */
  const openReview = () => {
    // Default each customer's address to their saved address, unless already set
    setAddresses(prev => {
      const next = { ...prev };
      cartCustomerIds.forEach(cid => {
        if (!next[cid]) next[cid] = cart[cid].customer?.address || '';
      });
      return next;
    });
    setResults(null);
    setShowReview(true);
  };

  const selectedZone = zones.find(z => z.id === parseInt(deliveryZoneId)) || null;

  // Guards against accidentally submitting the same batch twice (e.g. a
  // double-click, or reopening Review without changing anything) — warns
  // rather than silently blocking, since resubmitting the same batch on
  // purpose (e.g. retrying after a transient error) is legitimate too.
  const buildSignature = () => JSON.stringify({
    customers: cartCustomerIds.sort(),
    items: cartCustomerIds.map(cid => Object.values(cart[cid].items).map(i => `${i.product_id}:${i.quantity}`).sort()),
    paymentMethod,
  });

  const handleApply = async () => {
    const missingAddress = cartCustomerIds.find(cid => !addresses[cid]?.trim());
    if (missingAddress) {
      alert(`${cart[missingAddress].customer?.name} is missing a delivery address — fill it in before applying.`);
      return;
    }
    if (paymentMethod === 'momo' && !momoReference.trim()) {
      alert('Enter a MoMo reference for this batch before applying.');
      return;
    }

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
          items: Object.values(cart[cid].items).map(it => ({
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          payment_method: paymentMethod,
          delivery_address: addresses[cid],
          notes: notes || '',
          ...(momoReference ? { momo_reference: momoReference } : {}),
          ...(deliveryZoneId ? { delivery_zone_id: parseInt(deliveryZoneId) } : {}),
        })),
      };
      lastSubmitSignature.current = { signature, at: Date.now() };
      const res = await ordersAPI.createBulk(payload);
      setResults(res.data);
      setAssignResults(null);
      setAssignRiderId('');
      // Clear out any customers that succeeded — leave failed ones in the
      // cart so they can be fixed and retried without starting over.
      if (res.data.created_count > 0) {
        const failedIds = new Set((res.data.errors || []).map(e => String(e.customer_id)));
        setCart(prev => {
          const next = {};
          Object.keys(prev).forEach(cid => {
            if (failedIds.has(String(cid))) next[cid] = prev[cid];
          });
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
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading...</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mass Order</h1>
          <p className="page-subtitle">Build orders for many customers at once, then apply them all together</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/billing')}>← Back to Billing</button>
      </div>

      {/* ── Results banner, after Apply ── */}
      {results && (
        <div className={`alert ${results.failed_count > 0 ? 'alert-warning' : 'alert-success'}`} style={{ marginBottom: '1.5rem' }}>
          <strong>{results.created_count} order{results.created_count !== 1 ? 's' : ''} created.</strong>
          {results.failed_count > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>{results.failed_count} failed</strong> — still in your cart to fix and retry:
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                {results.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: '0.85rem' }}>
                    {customers.find(c => c.id === parseInt(e.customer_id))?.name || `Customer ${e.customer_id}`}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.created_count > 0 && !assignResults && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <strong style={{ fontSize: '0.9rem' }}>Assign all {results.created_count} to a rider now?</strong>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-input" style={{ flex: 2, minWidth: 180 }} value={assignRiderId} onChange={e => setAssignRiderId(e.target.value)}>
                  <option value="">Select rider…</option>
                  {riders.map(r => <option key={r.id} value={r.user_id}>{r.name}{r.is_available === false ? ' (busy)' : ''}</option>)}
                </select>
                <input type="date" className="form-input" style={{ flex: 1, minWidth: 140 }} value={assignDate} onChange={e => setAssignDate(e.target.value)} />
                <button className="btn btn-primary" disabled={!assignRiderId || assigning} onClick={assignAllToRider}>
                  {assigning ? `Assigning ${assignProgress?.done || 0}/${assignProgress?.total || 0}…` : 'Assign All'}
                </button>
              </div>
              <button className="btn btn-sm" style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: 'var(--text-2)', textDecoration: 'underline', padding: 0 }} onClick={() => navigate('/scheduler')}>
                or assign individually in Scheduler →
              </button>
            </div>
          )}
          {assignResults && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <strong style={{ color: '#16a34a' }}>✓ {assignResults.assigned} order{assignResults.assigned !== 1 ? 's' : ''} assigned to {riders.find(r => String(r.user_id) === String(assignRiderId))?.name}</strong>
              {assignResults.failed.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#c2410c' }}>{assignResults.failed.length} couldn't be assigned:</strong>
                  <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>
                    {assignResults.failed.map((f, i) => <li key={i} style={{ fontSize: '0.85rem' }}>{f}</li>)}
                  </ul>
                  <button className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/scheduler')}>
                    Resolve the rest in Scheduler →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'flex-start' }}>

        {/* ── LEFT: Round builder ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Build a Round</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Pick customers + items, then click Done to add them to the cart</span>
          </div>

          <div className="billing-review-label" style={{ marginBottom: '0.5rem' }}>1. Select Customers</div>
          <div className="form-group">
            <input
              className="form-input"
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
          </div>
          <div className="billing-customer-list">
            {filteredCustomers.slice(0, 30).map(c => (
              <div
                key={c.id}
                className={'billing-customer-item' + (roundCustomerIds.has(c.id) ? ' selected' : '')}
                onClick={() => toggleRoundCustomer(c)}
              >
                <input type="checkbox" checked={roundCustomerIds.has(c.id)} onChange={() => {}} style={{ flexShrink: 0 }} />
                <div className="avatar avatar-sm" style={{ background: 'var(--navy)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                  {c.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{c.phone}</div>
                </div>
                {cart[c.id] && <span className="badge badge-blue">In cart</span>}
              </div>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="empty-state"><div className="empty-icon">👤</div><p>No customers found</p></div>
            )}
          </div>
          {roundCustomerIds.size > 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent-dim)', marginTop: '0.5rem' }}>
              {roundCustomerIds.size} customer{roundCustomerIds.size !== 1 ? 's' : ''} selected for this round
            </p>
          )}

          <div className="divider" style={{ margin: '1.25rem 0' }} />

          <div className="billing-review-label" style={{ marginBottom: '0.5rem' }}>2. Select Items</div>
          {roundItems.map((item, idx) => (
            <div key={idx} className="billing-item-row">
              <div className="form-group" style={{ flex: 3, margin: 0 }}>
                <label className="form-label">Product</label>
                <select
                  className="form-input"
                  value={item.product_id}
                  onChange={e => updateRoundItem(idx, 'product_id', e.target.value)}
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — GHS {parseFloat(p.price).toFixed(2)} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Default Qty</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={item.defaultQty}
                  onChange={e => updateRoundItem(idx, 'defaultQty', e.target.value)}
                />
              </div>
              <button className="btn btn-sm btn-danger" style={{ marginTop: '1.5rem', flexShrink: 0 }} onClick={() => removeRoundItem(idx)}>✕</button>
            </div>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={addRoundItem}>+ Add Item</button>

          {roundCustomerIds.size > 0 && roundItems.some(it => it.product_id) && (
            <>
              <div className="divider" style={{ margin: '1.25rem 0' }} />
              <div className="billing-review-label" style={{ marginBottom: '0.5rem' }}>
                3. Adjust Quantities Per Customer <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional — defaults above apply otherwise)</span>
              </div>
              <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      {roundItems.filter(it => it.product_id).map(it => (
                        <th key={it.product_id}>{products.find(p => p.id === parseInt(it.product_id))?.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...roundCustomerIds].map(cid => {
                      const customer = customers.find(c => c.id === cid);
                      return (
                        <tr key={cid}>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{customer?.name}</td>
                          {roundItems.filter(it => it.product_id).map(it => (
                            <td key={it.product_id}>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                style={{ width: 70 }}
                                value={qtyFor(cid, it.product_id)}
                                onChange={e => setQtyFor(cid, it.product_id, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" disabled={!roundReady} onClick={commitRound}>
              ✓ Done — Add This Round to Cart
            </button>
          </div>
        </div>

        {/* ── RIGHT: Cart summary ── */}
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <div className="card-header">
            <h3 className="card-title">Cart</h3>
            <span className="badge badge-blue">{cartCustomerIds.length} customer{cartCustomerIds.length !== 1 ? 's' : ''}</span>
          </div>

          {cartCustomerIds.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛒</div>
              <p>No customers added yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 460, overflowY: 'auto' }}>
              {cartCustomerIds.map(cid => {
                const entry = cart[cid];
                return (
                  <div key={cid} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{entry.customer?.name}</div>
                      <button className="btn btn-sm btn-danger" onClick={() => removeCustomerFromCart(cid)}>✕</button>
                    </div>
                    {Object.values(entry.items).map(it => (
                      <div key={it.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '4px' }}>
                        <span>{it.name}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ×
                          <input
                            type="number" min="1" value={it.quantity}
                            onChange={e => updateCartItemQty(cid, it.product_id, e.target.value)}
                            style={{ width: 44, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4 }}
                          />
                          <span style={{ minWidth: 60, textAlign: 'right' }}>{formatCurrency(it.unit_price * it.quantity)}</span>
                          <button onClick={() => removeItemFromCustomer(cid, it.product_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                        </span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span>Subtotal</span>
                      <span style={{ color: 'var(--accent)' }}>{formatCurrency(customerSubtotal(entry))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="billing-total-bar" style={{ marginTop: '1rem' }}>
            <span>Cart Total</span>
            <strong style={{ fontSize: '1.25rem', color: '#22c55e' }}>{formatCurrency(cartTotal)}</strong>
          </div>

          <button
            className="btn btn-success"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={cartCustomerIds.length === 0}
            onClick={openReview}
          >
            Review &amp; Apply Order →
          </button>
        </div>
      </div>

      {/* ── Review / Apply modal ── */}
      {showReview && (
        <div className="modal-overlay" onClick={() => !submitting && setShowReview(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Review &amp; Apply — {cartCustomerIds.length} Orders</h2>
              <button className="modal-close" onClick={() => setShowReview(false)}>✕</button>
            </div>

            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Payment method, delivery zone, and notes below apply to <strong>every order in this batch</strong>.
              Delivery address is set per customer. Riders are assigned afterward from Scheduler — these orders go in unassigned.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Payment Method (all orders)</label>
                <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="momo">MTN MoMo</option>
                  <option value="cod">Pay on Delivery</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Delivery Zone (optional)</label>
                <select className="form-input" value={deliveryZoneId} onChange={e => setDeliveryZoneId(e.target.value)}>
                  <option value="">No zone</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name} — GHS {parseFloat(z.fee).toFixed(2)}</option>)}
                </select>
              </div>
            </div>

            {paymentMethod === 'momo' && (
              <div className="form-group">
                <label className="form-label">MoMo Reference (all orders) *</label>
                <input className="form-input" value={momoReference} onChange={e => setMomoReference(e.target.value)} placeholder="Enter MoMo transaction reference" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes (optional, applies to all orders)</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bulk order, deliver together where possible" />
            </div>

            <div className="divider" style={{ margin: '1rem 0' }} />

            <div className="billing-review-label" style={{ marginBottom: '0.5rem' }}>Per-Customer Delivery Address</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 260, overflowY: 'auto' }}>
              {cartCustomerIds.map(cid => (
                <div key={cid} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', width: 140, flexShrink: 0 }}>{cart[cid].customer?.name}</span>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={addresses[cid] || ''}
                    onChange={e => setAddresses(prev => ({ ...prev, [cid]: e.target.value }))}
                    placeholder="Delivery address"
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', minWidth: 70, textAlign: 'right' }}>
                    {formatCurrency(customerSubtotal(cart[cid]))}
                  </span>
                </div>
              ))}
            </div>

            <div className="billing-total-bar" style={{ marginTop: '1.25rem' }}>
              <span>Items Total ({cartCustomerIds.length} orders)</span>
              <strong style={{ fontSize: '1.25rem', color: '#22c55e' }}>{formatCurrency(cartTotal)}</strong>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
              Final per-order total (including delivery fee/discount) is calculated when each order is created.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowReview(false)} disabled={submitting}>← Back to Cart</button>
              <button className="btn btn-success" onClick={handleApply} disabled={submitting} style={{ minWidth: 200 }}>
                {submitting ? 'Applying...' : `Apply Order — ${cartCustomerIds.length} Customers`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MassOrder;
