import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, ridersAPI, ordersAPI } from '../../utils/api';

// One key per mount — reused across retries of the same submission so a
// dropped network response can't create the order twice. A fresh key is
// only generated when the component remounts (i.e. a genuinely new sale).
const genIdempotencyKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `txn_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Same Ghana phone rules as desktop Billing.js — kept identical on purpose
// so validation behavior never diverges between the two entry points.
const validateGhanaPhone = (phone) => {
  const cleaned = phone.replace(/\s|-/g, '');
  const localFormat = /^0([23456789]\d{8})$/;
  const intlFormat = /^\+233([23456789]\d{8})$/;
  return localFormat.test(cleaned) || intlFormat.test(cleaned);
};
const formatGhanaPhone = (phone) => {
  const cleaned = phone.replace(/\s|-/g, '');
  if (cleaned.startsWith('+233') && cleaned.length === 13) {
    return cleaned.replace(/(\+233)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  }
  return phone;
};
const formatCurrency = (n) => 'GHS ' + parseFloat(n || 0).toFixed(2);

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const label = { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const errText = { color: '#ef4444', fontSize: 12, marginTop: 4 };

const TransportBilling = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [riders, setRiders] = useState([]);

  const [customerMode, setCustomerMode] = useState('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });

  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState([]); // [{product_id, name, price, qty, stock}]

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [momoReference, setMomoReference] = useState('');
  const [selectedRider, setSelectedRider] = useState('');
  const [notes, setNotes] = useState('');

  const [idempotencyKey] = useState(genIdempotencyKey);
  const lastSubmitSignature = useRef(null); // { signature, at } of the last order actually sent

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [c, p, r] = await Promise.all([
        customersAPI.getAll({ limit: 200 }),
        productsAPI.getAll({ limit: 200 }),
        ridersAPI.getAll(),
      ]);
      setCustomers(c.data.customers || []);
      setProducts((p.data.products || []).filter(pr => pr.is_active && pr.stock_quantity > 0));
      setRiders(r.data.riders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  const addToCart = (product) => {
    setProductSearch('');
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.qty >= product.stock_quantity) return prev;
        return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, price: parseFloat(product.price), qty: 1, stock: product.stock_quantity }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.product_id === productId ? { ...i, qty: Math.max(1, Math.min(i.stock, i.qty + delta)) } : i)
    );
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.product_id !== productId));

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerSearch('');
    setDeliveryAddress(c.address || '');
  };

  const validate = () => {
    const errs = {};
    if (customerMode === 'existing') {
      if (!selectedCustomer) errs.customer = 'Select a customer, or switch to "New" to add one';
    } else {
      if (!newCustomer.name.trim() || newCustomer.name.trim().length < 3) errs.name = 'Enter the customer\'s full name';
      if (!newCustomer.phone.trim()) errs.phone = 'Phone number is required';
      else if (!validateGhanaPhone(newCustomer.phone)) errs.phone = 'Enter a valid Ghana number (e.g. 0244123456)';
      if (!newCustomer.address.trim()) errs.address_customer = 'Address is required';
    }
    if (cart.length === 0) errs.cart = 'Add at least one product';
    if (!deliveryAddress.trim()) errs.address = 'Delivery address is required';
    if (!selectedRider) errs.rider = 'Assign a rider for this delivery';
    if (paymentMethod === 'momo') {
      if (!momoReference.trim()) errs.momo = 'MoMo reference is required';
      else if (!/^\d{10,12}$/.test(momoReference.replace(/\s/g, ''))) errs.momo = 'Reference must be 10–12 digits';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Cart + customer + total fingerprint — used only to catch an accidental
  // double-tap of "Create Sale" on the exact same order, not to block
  // legitimate repeat purchases from a returning customer.
  const buildSignature = (customerId) => JSON.stringify({
    customerId,
    items: cart.map(i => `${i.product_id}:${i.qty}`).sort(),
    total,
    paymentMethod,
  });

  const handleSubmit = async () => {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const signature = buildSignature(selectedCustomer?.id ?? 'new:' + newCustomer.phone);
    const last = lastSubmitSignature.current;
    if (last && last.signature === signature && Date.now() - last.at < 2 * 60 * 1000) {
      const proceed = window.confirm(
        'This looks like the same sale you just submitted (same customer, items and total). Submit again anyway?'
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      // Live stock re-check — catches another agent selling the last unit
      // between this screen loading and now, before we touch the backend.
      const freshRes = await productsAPI.getAll({ limit: 200 });
      const freshProducts = freshRes.data.products || [];
      const shortfalls = cart
        .map(item => {
          const fresh = freshProducts.find(p => p.id === item.product_id);
          const available = fresh ? fresh.stock_quantity : 0;
          return available < item.qty ? { name: item.name, available } : null;
        })
        .filter(Boolean);

      if (shortfalls.length > 0) {
        setErrors({
          cart: shortfalls.map(s => `${s.name}: only ${s.available} left`).join(' · ') + ' — please adjust the cart',
        });
        setSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      let customerId = selectedCustomer?.id;
      if (customerMode === 'new') {
        const res = await customersAPI.create({ ...newCustomer, phone: formatGhanaPhone(newCustomer.phone) });
        customerId = res.data.customer.id;
      }

      const orderPayload = {
        customer_id: parseInt(customerId),
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.qty, unit_price: i.price })),
        payment_method: paymentMethod === 'paid_on_delivery' ? 'cod' : paymentMethod,
        delivery_address: deliveryAddress,
        notes: notes || '',
        idempotency_key: idempotencyKey,
        ...(paymentMethod === 'momo' && momoReference ? { momo_reference: momoReference } : {}),
      };

      lastSubmitSignature.current = { signature, at: Date.now() };

      const orderRes = await ordersAPI.create(orderPayload);
      const orderId = orderRes.data.order.id;

      try {
        await ridersAPI.assignDelivery({ order_id: orderId, rider_id: parseInt(selectedRider) });
      } catch (assignErr) {
        console.error('assignDelivery error:', assignErr);
        if (assignErr.response?.data?.code === 'PAYMENT_NOT_VERIFIED') {
          // Expected, not an error — MoMo orders can't be assigned until
          // someone on the dashboard verifies the payment. Worded calmly
          // rather than as a failure, since nothing actually went wrong.
          alert('Sale created ✓\n\nA rider can be assigned once this order\'s MoMo payment is verified on the dashboard.');
        } else {
          alert('Order created, but rider assignment failed: ' + (assignErr.response?.data?.message || assignErr.message));
        }
      }

      navigate('/transport/deliveries', { state: { newOrderId: orderId, orderNumber: orderRes.data.order.order_number } });
    } catch (err) {
      alert('Error creating order: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  return (
    <div style={{ paddingBottom: 90 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '4px 0 16px' }}>New Sale</h1>

      {/* Customer */}
      <div style={card}>
        <span style={label}>Customer</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['existing', 'new'].map(m => (
            <button key={m} onClick={() => { setCustomerMode(m); setErrors({}); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: customerMode === m ? '1px solid #22c55e' : '1px solid #e5e7eb',
                background: customerMode === m ? '#f0fdf4' : '#fff',
                color: customerMode === m ? '#16a34a' : '#6b7280',
              }}>
              {m === 'existing' ? 'Existing' : 'New'}
            </button>
          ))}
        </div>

        {customerMode === 'existing' ? (
          <>
            {selectedCustomer ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f0fdf4', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedCustomer.phone}</div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Change</button>
              </div>
            ) : (
              <>
                <input style={input} placeholder="Search by name or phone…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {filteredCustomers.map(c => (
                  <div key={c.id} onClick={() => selectCustomer(c)}
                    style={{ padding: '10px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.phone}</div>
                  </div>
                ))}
              </>
            )}
            {errors.customer && <div style={errText}>{errors.customer}</div>}
          </>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <input style={input} placeholder="Full name" value={newCustomer.name}
                onChange={e => { setNewCustomer({ ...newCustomer, name: e.target.value }); setErrors({ ...errors, name: null }); }} />
              {errors.name && <div style={errText}>{errors.name}</div>}
            </div>
            <div>
              <input style={input} placeholder="0244123456" value={newCustomer.phone}
                onChange={e => { setNewCustomer({ ...newCustomer, phone: e.target.value.replace(/[^\d\s\-\+]/g, '') }); setErrors({ ...errors, phone: null }); }} />
              {errors.phone && <div style={errText}>{errors.phone}</div>}
            </div>
            <div>
              <input style={input} placeholder="Address" value={newCustomer.address}
                onChange={e => { setNewCustomer({ ...newCustomer, address: e.target.value }); setDeliveryAddress(e.target.value); setErrors({ ...errors, address_customer: null }); }} />
              {errors.address_customer && <div style={errText}>{errors.address_customer}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Products / cart */}
      <div style={card}>
        <span style={label}>Items</span>
        <input style={input} placeholder="Search products to add…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
        {filteredProducts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.stock_quantity} in stock</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(p.price)}</div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {cart.map(item => (
              <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{formatCurrency(item.price)} each</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => changeQty(item.product_id, -1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => changeQty(item.product_id, 1)} style={qtyBtn}>+</button>
                  <button onClick={() => removeFromCart(item.product_id)} style={{ ...qtyBtn, color: '#ef4444', marginLeft: 4 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {errors.cart && <div style={errText}>{errors.cart}</div>}
      </div>

      {/* Delivery + payment */}
      <div style={card}>
        <span style={label}>Delivery Address</span>
        <input style={input} value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); setErrors({ ...errors, address: null }); }} placeholder="e.g. Tabora, near Peace & Victory, Accra" />
        {errors.address && <div style={errText}>{errors.address}</div>}

        <span style={{ ...label, marginTop: 14 }}>Rider</span>
        <select style={input} value={selectedRider} onChange={e => { setSelectedRider(e.target.value); setErrors({ ...errors, rider: null }); }}>
          <option value="">Select a rider…</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_available === false ? ' (busy)' : ''}</option>)}
        </select>
        {errors.rider && <div style={errText}>{errors.rider}</div>}

        <span style={{ ...label, marginTop: 14 }}>Payment</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'cash', l: '💵 Cash' }, { v: 'momo', l: '📱 MoMo' }, { v: 'paid_on_delivery', l: '🚪 On Delivery' }].map(opt => (
            <button key={opt.v} onClick={() => setPaymentMethod(opt.v)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: paymentMethod === opt.v ? '1px solid #22c55e' : '1px solid #e5e7eb',
                background: paymentMethod === opt.v ? '#f0fdf4' : '#fff',
                color: paymentMethod === opt.v ? '#16a34a' : '#6b7280',
              }}>
              {opt.l}
            </button>
          ))}
        </div>
        {paymentMethod === 'momo' && (
          <div style={{ marginTop: 10 }}>
            <input style={input} placeholder="MoMo transaction reference" value={momoReference} onChange={e => { setMomoReference(e.target.value); setErrors({ ...errors, momo: null }); }} />
            {errors.momo && <div style={errText}>{errors.momo}</div>}
          </div>
        )}

        <span style={{ ...label, marginTop: 14 }}>Notes</span>
        <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions (optional)" />
      </div>

      {/* Sticky submit bar */}
      <div style={{
        position: 'fixed', bottom: 62, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #f3f4f6',
        padding: '12px 16px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 90,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TOTAL</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{formatCurrency(total)}</div>
        </div>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ padding: '13px 28px', borderRadius: 12, border: 'none', background: '#1a1a18', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Creating…' : 'Create Sale'}
        </button>
      </div>
    </div>
  );
};

const qtyBtn = { width: 26, height: 26, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#1a1a18' };

export default TransportBilling;
