import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, ridersAPI, ordersAPI, deliveryZonesAPI, pricingSettingsAPI } from '../../utils/api';

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

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

export default function PortalBilling() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [riders, setRiders] = useState([]);
  const [zones, setZones] = useState([]);
  const [pricingSettings, setPricingSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [customerMode, setCustomerMode] = useState('new');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, name: '' }]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [momoReference, setMomoReference] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedRider, setSelectedRider] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryZoneId, setDeliveryZoneId] = useState('');
  const [manualDiscount, setManualDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [c, p, r, z, ps] = await Promise.all([
        customersAPI.getAll({ limit: 200 }),
        productsAPI.getAll({ limit: 200 }),
        ridersAPI.getAll(),
        deliveryZonesAPI.getAll(),
        pricingSettingsAPI.get(),
      ]);
      setCustomers(c.data.customers || []);
      setProducts((p.data.products || []).filter(pr => pr.is_active && pr.stock_quantity > 0));
      setRiders(r.data.riders || []);
      setZones(z.data.zones || []);
      setPricingSettings(ps.data.settings || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setOrderItems([...orderItems, { product_id: '', quantity: 1, unit_price: 0, name: '' }]);
  const removeItem = (idx) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };
  const updateItem = (idx, field, value) => {
    const updated = [...orderItems];
    updated[idx][field] = value;
    if (field === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        updated[idx].unit_price = parseFloat(product.price);
        updated[idx].name = product.name;
      }
    }
    setOrderItems(updated);
  };
  const getTotal = () => orderItems.reduce((sum, item) =>
    sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0), 0
  );

  const selectedZone = zones.find(z => z.id === parseInt(deliveryZoneId)) || null;
  const orderSubtotal = getTotal();
  const freeDeliveryThreshold = pricingSettings?.free_delivery_threshold;
  const qualifiesForFreeDelivery = freeDeliveryThreshold != null && orderSubtotal >= parseFloat(freeDeliveryThreshold);
  const estimatedDeliveryFee = selectedZone
    ? (qualifiesForFreeDelivery ? 0 : parseFloat(selectedZone.fee))
    : 0;
  const belowZoneMinimum = selectedZone?.min_order_amount > 0 && orderSubtotal < parseFloat(selectedZone.min_order_amount);
  const maxDiscountCap = pricingSettings
    ? (pricingSettings.max_manual_discount_type === 'percent'
        ? orderSubtotal * (parseFloat(pricingSettings.max_manual_discount) / 100)
        : parseFloat(pricingSettings.max_manual_discount))
    : 0;
  const manualDiscountValue = parseFloat(manualDiscount) || 0;
  const discountExceedsCap = manualDiscountValue > maxDiscountCap;
  const estimatedGrandTotal = Math.max(0, orderSubtotal + estimatedDeliveryFee - manualDiscountValue);

  const handlePhoneInput = (val) => {
    const cleaned = val.replace(/[^\d\s\-\+]/g, '');
    setNewCustomer({ ...newCustomer, phone: cleaned });
    if (errors.phone) setErrors({ ...errors, phone: null });
  };

  const validate = () => {
    const errs = {};
    if (customerMode === 'new') {
      if (!newCustomer.name.trim()) errs.name = 'Customer name is required';
      if (!newCustomer.phone.trim()) errs.phone = 'Phone number is required';
      else if (!validateGhanaPhone(newCustomer.phone)) errs.phone = 'Enter a valid Ghana phone number';
    } else if (!selectedCustomer) {
      errs.customer = 'Please select a customer';
    }
    orderItems.forEach((item, idx) => {
      if (!item.product_id) errs['product_' + idx] = 'Select a product';
      if (!item.unit_price || parseFloat(item.unit_price) <= 0) errs['price_' + idx] = 'Unit price must be greater than 0';
    });
    if (!deliveryAddress.trim()) errs.address = 'Delivery address is required';
    else if (deliveryAddress.trim().length < 5) errs.address = 'Please enter a complete delivery address';
    if (!selectedRider) errs.rider = 'Please assign a rider';
    if (!notes.trim()) errs.notes = 'Please add delivery notes or instructions';
    if (belowZoneMinimum) errs.delivery_zone = `${selectedZone.name} requires a minimum order of ${fmt(selectedZone.min_order_amount)}`;
    if (discountExceedsCap) errs.discount = `Discount exceeds the maximum allowed (${fmt(maxDiscountCap)})`;
    if (!paymentMethod) errs.payment = 'Please select a payment method';
    if (paymentMethod === 'momo') {
      if (!momoReference.trim()) errs.momo = 'MoMo reference number is required';
      else if (!/^\d{10,12}$/.test(momoReference.replace(/\s/g, ''))) errs.momo = 'Invalid MoMo reference — must be 10 to 12 digits';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    try {
      let customerId = selectedCustomer;
      if (customerMode === 'new') {
        const res = await customersAPI.create({ ...newCustomer, phone: formatGhanaPhone(newCustomer.phone) });
        customerId = res.data.customer.id;
      }

      const orderPayload = {
        customer_id: parseInt(customerId),
        items: orderItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
        payment_method: paymentMethod === 'paid_on_delivery' ? 'cod' : paymentMethod,
        delivery_address: deliveryAddress,
        notes: notes || '',
        ...(paymentMethod === 'momo' && momoReference ? { momo_reference: momoReference } : {}),
        ...(deliveryZoneId ? { delivery_zone_id: parseInt(deliveryZoneId) } : {}),
        ...(manualDiscountValue > 0 ? { manual_discount: manualDiscountValue, discount_reason: discountReason || undefined } : {}),
      };

      const orderRes = await ordersAPI.create(orderPayload);
      const orderId = orderRes.data.order.id;

      if (selectedRider) {
        try {
          await ridersAPI.assignDelivery({ order_id: orderId, rider_id: parseInt(selectedRider) });
        } catch (assignErr) {
          console.error('assignDelivery error:', assignErr);
          alert('Order created, but rider assignment failed: ' + (assignErr.response?.data?.message || assignErr.message));
        }
      }

      alert(`Order ${orderRes.data.order.order_number} created.`);
      navigate('/portal/orders');
    } catch (err) {
      alert('Error creating order: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );

  if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

  const sectionStyle = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 };
  const labelStyle = { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 };
  const errStyle = { fontSize: 11, color: '#dc2626', marginTop: 4 };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 16px' }}>New Bill</h1>

      <div style={sectionStyle}>
        <label style={labelStyle}>Customer</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['new', 'existing'].map(m => (
            <button key={m} onClick={() => setCustomerMode(m)} style={{
              flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: customerMode === m ? '#1a1a18' : '#f3f4f6', color: customerMode === m ? '#fff' : '#6b7280',
            }}>
              {m === 'new' ? '+ New Customer' : 'Existing Customer'}
            </button>
          ))}
        </div>

        {customerMode === 'new' ? (
          <>
            <input className="form-input" placeholder="Full name" value={newCustomer.name}
              onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
            {errors.name && <p style={errStyle}>{errors.name}</p>}
            <input className="form-input" placeholder="Phone (e.g. 0241234567)" value={newCustomer.phone}
              onChange={e => handlePhoneInput(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
            {errors.phone && <p style={errStyle}>{errors.phone}</p>}
            <input className="form-input" placeholder="Email (optional)" value={newCustomer.email}
              onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} style={{ width: '100%' }} />
          </>
        ) : (
          <>
            <input className="form-input" placeholder="Search customers…" value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
            <select className="form-input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select a customer…</option>
              {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
            {errors.customer && <p style={errStyle}>{errors.customer}</p>}
          </>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Items</label>
          <button onClick={addItem} style={{ background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Add Item</button>
        </div>
        {orderItems.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < orderItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
            <select className="form-input" value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} style={{ width: '100%', marginBottom: 6 }}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}
            </select>
            {errors['product_' + idx] && <p style={errStyle}>{errors['product_' + idx]}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="number" min="1" placeholder="Qty" value={item.quantity}
                onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ width: 70 }} />
              <input className="form-input" type="number" step="0.01" placeholder="Unit price" value={item.unit_price}
                onChange={e => updateItem(idx, 'unit_price', e.target.value)} style={{ flex: 1 }} />
              {orderItems.length > 1 && (
                <button onClick={() => removeItem(idx)} style={{ width: 36, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✕</button>
              )}
            </div>
            {errors['price_' + idx] && <p style={errStyle}>{errors['price_' + idx]}</p>}
          </div>
        ))}
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1a1a18', marginTop: 4 }}>
          Subtotal: {fmt(orderSubtotal)}
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Delivery Address</label>
        <input className="form-input" placeholder="Full delivery address" value={deliveryAddress}
          onChange={e => setDeliveryAddress(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        {errors.address && <p style={errStyle}>{errors.address}</p>}

        <label style={labelStyle}>Delivery Zone (optional)</label>
        <select className="form-input" value={deliveryZoneId} onChange={e => setDeliveryZoneId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
          <option value="">No zone selected</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name} — {fmt(z.fee)}</option>)}
        </select>
        {errors.delivery_zone && <p style={errStyle}>{errors.delivery_zone}</p>}

        <label style={labelStyle}>Assign Rider</label>
        <select className="form-input" value={selectedRider} onChange={e => setSelectedRider(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
          <option value="">Select a rider…</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name} — {r.phone} — {r.is_available ? 'Available' : 'Busy'}</option>)}
        </select>
        {errors.rider && <p style={errStyle}>{errors.rider}</p>}

        <label style={labelStyle}>Delivery Notes</label>
        <input className="form-input" placeholder="Landmark, instructions, etc." value={notes}
          onChange={e => setNotes(e.target.value)} style={{ width: '100%' }} />
        {errors.notes && <p style={errStyle}>{errors.notes}</p>}
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Payment Method</label>
        <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
          <option value="cash">Cash</option>
          <option value="momo">Mobile Money</option>
          <option value="paid_on_delivery">Cash on Delivery</option>
        </select>
        {errors.payment && <p style={errStyle}>{errors.payment}</p>}

        {paymentMethod === 'momo' && (
          <>
            <input className="form-input" placeholder="MoMo reference number" value={momoReference}
              onChange={e => setMomoReference(e.target.value)} style={{ width: '100%', marginBottom: 4 }} />
            {errors.momo && <p style={errStyle}>{errors.momo}</p>}
          </>
        )}

        <label style={{ ...labelStyle, marginTop: 10 }}>Manual Discount (optional)</label>
        <input className="form-input" type="number" step="0.01" placeholder="0.00" value={manualDiscount}
          onChange={e => setManualDiscount(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        {errors.discount && <p style={errStyle}>{errors.discount}</p>}
        {manualDiscountValue > 0 && (
          <input className="form-input" placeholder="Reason for discount" value={discountReason}
            onChange={e => setDiscountReason(e.target.value)} style={{ width: '100%' }} />
        )}
      </div>

      <div style={{ background: '#1a1a18', borderRadius: 14, padding: 16, marginBottom: 16, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, opacity: 0.7 }}>
          <span>Subtotal</span><span>{fmt(orderSubtotal)}</span>
        </div>
        {selectedZone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, opacity: 0.7 }}>
            <span>Delivery ({selectedZone.name}){qualifiesForFreeDelivery && ' — Free!'}</span>
            <span>{fmt(estimatedDeliveryFee)}</span>
          </div>
        )}
        {manualDiscountValue > 0 && !discountExceedsCap && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#fca5a5' }}>
            <span>Discount</span><span>− {fmt(manualDiscountValue)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <span>Total (est.)</span><span style={{ color: '#22c55e' }}>{fmt(estimatedGrandTotal)}</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        {submitting ? 'Creating…' : `Create Order — ${fmt(estimatedGrandTotal)}`}
      </button>
    </div>
  );
}
