import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, ridersAPI, ordersAPI } from '../utils/api';
import './Billing.css';

// Ghana phone validation
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

const Billing = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [customerMode, setCustomerMode] = useState('new');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, name: '' }]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [momoReference, setMomoReference] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedRider, setSelectedRider] = useState('');
  const [notes, setNotes] = useState('');
  const [showCashConfirm, setShowCashConfirm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [c, p, r] = await Promise.all([
        customersAPI.getAll({ limit: 200 }),
        productsAPI.getAll({ limit: 200 }),
        ridersAPI.getAll(),
      ]);
      setCustomers(c.data.customers || []);
      setProducts((p.data.products || []).filter(p => p.is_active && p.stock_quantity > 0));
      setRiders(r.data.riders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

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

  // ── Validations ──
  const validateStep1 = () => {
    const errs = {};

    if (customerMode === 'existing') {
      if (!selectedCustomer) errs.customer = 'Please select a customer';
    } else {
      // Name validation
      if (!newCustomer.name.trim()) {
        errs.name = 'Full name is required';
      } else if (newCustomer.name.trim().length < 3) {
        errs.name = 'Name must be at least 3 characters';
      } else if (!/^[a-zA-Z\s\-'\.]+$/.test(newCustomer.name.trim())) {
        errs.name = 'Name must contain letters only (no numbers or special characters)';
      } else {
        const duplicate = customers.find(c =>
          c.name.toLowerCase().trim() === newCustomer.name.toLowerCase().trim()
        );
        if (duplicate) errs.name = 'A customer with this name already exists. Use the Existing Customer tab.';
      }

      // Phone validation
      if (!newCustomer.phone.trim()) {
        errs.phone = 'Phone number is required';
      } else if (/[a-zA-Z]/.test(newCustomer.phone)) {
        errs.phone = 'Phone number must contain numbers only';
      } else if (!validateGhanaPhone(newCustomer.phone)) {
        errs.phone = 'Enter a valid Ghana number — 10 digits starting with 0 (e.g. 0244123456) or +233 format';
      } else {
        const dupPhone = customers.find(c =>
          c.phone?.replace(/[\s\-]/g, '') === newCustomer.phone.replace(/[\s\-]/g, '')
        );
        if (dupPhone) errs.phone = 'This number is already registered to ' + dupPhone.name;
      }

      // Email - optional but must be valid if filled
      if (newCustomer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email.trim())) {
        errs.email = 'Enter a valid email address (e.g. name@example.com)';
      }

      // Address - required
      if (!newCustomer.address.trim()) {
        errs.address_customer = 'Address is required';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    orderItems.forEach((item, idx) => {
      if (!item.product_id) {
        errs['product_' + idx] = 'Please select a product';
      }
      if (!item.quantity || parseInt(item.quantity) < 1) {
        errs['qty_' + idx] = 'Quantity must be at least 1';
      } else if (!/^\d+$/.test(String(item.quantity))) {
        errs['qty_' + idx] = 'Quantity must be a whole number';
      } else {
        const product = products.find(p => p.id === parseInt(item.product_id));
        if (product && parseInt(item.quantity) > product.stock_quantity) {
          errs['qty_' + idx] = 'Only ' + product.stock_quantity + ' in stock';
        }
      }
      if (!item.unit_price || parseFloat(item.unit_price) <= 0) {
        errs['price_' + idx] = 'Unit price must be greater than 0';
      }
    });
    if (!deliveryAddress.trim()) {
      errs.address = 'Delivery address is required';
    } else if (deliveryAddress.trim().length < 5) {
      errs.address = 'Please enter a complete delivery address';
    }
    if (!selectedRider) {
      errs.rider = 'Please assign a rider';
    }
    if (!notes.trim()) {
      errs.notes = 'Please add delivery notes or instructions';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!paymentMethod) {
      errs.payment = 'Please select a payment method';
    }
    if (paymentMethod === 'momo') {
      if (!momoReference.trim()) {
        errs.momo = 'MoMo reference number is required';
      } else if (!/^\d{10,12}$/.test(momoReference.replace(/\s/g, ''))) {
        errs.momo = 'Invalid MoMo reference — must be 10 to 12 digits (e.g. 33179874139)';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep3Next = () => {
    if (!validateStep3()) return;
    if (paymentMethod === 'cash') {
      setShowCashConfirm(true);
    } else {
      setStep(4);
    }
  };

  const handlePhoneInput = (val) => {
    // Only allow digits, +, spaces, dashes
    const cleaned = val.replace(/[^\d\s\-\+]/g, '');
    setNewCustomer({ ...newCustomer, phone: cleaned });
    if (errors.phone) setErrors({ ...errors, phone: null });
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setSubmitting(true);
    try {
      let customerId = selectedCustomer;
      if (customerMode === 'new') {
        const res = await customersAPI.create({
          ...newCustomer,
          phone: formatGhanaPhone(newCustomer.phone),
        });
        customerId = res.data.customer.id;
      }

      const orderPayload = {
        customer_id: parseInt(customerId),
        items: orderItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
        payment_method: paymentMethod === 'paid_on_delivery' ? 'cash' : paymentMethod,
        delivery_address: deliveryAddress,
        notes: (notes ? notes + ' | ' : '') + (paymentMethod === 'momo' && momoReference ? 'MoMo Ref: ' + momoReference : '') + (paymentMethod === 'paid_on_delivery' ? 'Paid on delivery' : ''),
      };

      const orderRes = await ordersAPI.create(orderPayload);
      const orderId = orderRes.data.order.id;

      if (selectedRider) {
        await ridersAPI.assignDelivery({ order_id: orderId, rider_id: parseInt(selectedRider) });
      }

      navigate('/receipts', { state: { newOrderId: orderId, orderNumber: orderRes.data.order.order_number } });
    } catch (err) {
      alert('Error creating order: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => 'GHS ' + parseFloat(amount || 0).toFixed(2);

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
          <h1 className="page-title">New Bill</h1>
          <p className="page-subtitle">Create an order and generate a receipt instantly</p>
        </div>
      </div>

      {/* Steps */}
      <div className="billing-steps">
        {[
          { n: 1, label: 'Customer' },
          { n: 2, label: 'Products' },
          { n: 3, label: 'Payment' },
          { n: 4, label: 'Review' },
        ].map(s => (
          <div key={s.n} className={'billing-step' + (step === s.n ? ' active' : step > s.n ? ' done' : '')}>
            <div className="billing-step-circle">{step > s.n ? '✓' : s.n}</div>
            <div className="billing-step-label">{s.label}</div>
            {s.n < 4 && <div className="billing-step-line" />}
          </div>
        ))}
      </div>

      {/* Step 1 - Customer */}
      {step === 1 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Customer Details</h3>
          </div>
          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={'tab-btn' + (customerMode === 'new' ? ' active' : '')} onClick={() => { setCustomerMode('new'); setErrors({}); }}>
              New Customer
            </button>
            <button className={'tab-btn' + (customerMode === 'existing' ? ' active' : '')} onClick={() => { setCustomerMode('existing'); setErrors({}); }}>
              Existing Customer
            </button>
          </div>

          {customerMode === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className={'form-input' + (errors.name ? ' input-error' : '')}
                  value={newCustomer.name}
                  onChange={e => { setNewCustomer({ ...newCustomer, name: e.target.value }); setErrors({ ...errors, name: null }); }}
                  placeholder="Enter full name"
                />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number * <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(Ghana format)</span></label>
                <input
                  className={'form-input' + (errors.phone ? ' input-error' : '')}
                  value={newCustomer.phone}
                  onChange={e => handlePhoneInput(e.target.value)}
                  placeholder="0244123456 or +233244123456"
                  maxLength={14}
                />
                {errors.phone && <div className="field-error">{errors.phone}</div>}
                {!errors.phone && newCustomer.phone && validateGhanaPhone(newCustomer.phone) && (
                  <div className="field-success">✓ Valid Ghana number</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Email <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className={'form-input' + (errors.email ? ' input-error' : '')}
                  value={newCustomer.email}
                  onChange={e => { setNewCustomer({ ...newCustomer, email: e.target.value }); setErrors({ ...errors, email: null }); }}
                  placeholder="email@example.com"
                />
                {errors.email && <div className="field-error">{errors.email}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Address *</label>
                <input
                  className={'form-input' + (errors.address_customer ? ' input-error' : '')}
                  value={newCustomer.address}
                  onChange={e => { setNewCustomer({ ...newCustomer, address: e.target.value }); setDeliveryAddress(e.target.value); setErrors({ ...errors, address_customer: null }); }}
                  placeholder="e.g. Tabora, near Peace & Victory, Accra"
                />
                {errors.address_customer && <div className="field-error">{errors.address_customer}</div>}
              </div>
            </div>
          )}

          {customerMode === 'existing' && (
            <div>
              {errors.customer && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{errors.customer}</div>}
              <div className="form-group">
                <label className="form-label">Search Customer</label>
                <input
                  className="form-input"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="billing-customer-list">
                {filteredCustomers.slice(0, 10).map(c => (
                  <div
                    key={c.id}
                    className={'billing-customer-item' + (selectedCustomer === c.id ? ' selected' : '')}
                    onClick={() => { setSelectedCustomer(c.id); setDeliveryAddress(c.address || ''); setErrors({ ...errors, customer: null }); }}
                  >
                    <div className="avatar avatar-sm" style={{ background: 'var(--navy)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{c.phone}</div>
                      {c.address && <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{c.address}</div>}
                    </div>
                    {selectedCustomer === c.id && <span className="badge badge-green">Selected</span>}
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">👤</div>
                    <p>No customers found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={() => { if (validateStep1()) setStep(2); }}>
              Next: Products →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 - Products */}
      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Order Items</h3>
            <button className="btn btn-sm btn-secondary" onClick={addItem}>+ Add Item</button>
          </div>

          {orderItems.map((item, idx) => (
            <div key={idx} className="billing-item-row">
              <div className="form-group" style={{ flex: 3, margin: 0 }}>
                <label className="form-label">Product</label>
                <select
                  className={'form-input' + (errors['product_' + idx] ? ' input-error' : '')}
                  value={item.product_id}
                  onChange={e => { updateItem(idx, 'product_id', e.target.value); setErrors({ ...errors, ['product_' + idx]: null }); }}
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — GHS {parseFloat(p.price).toFixed(2)} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
                {errors['product_' + idx] && <div className="field-error">{errors['product_' + idx]}</div>}
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Qty</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Unit Price</label>
                <input
                  className={'form-input' + (errors['price_' + idx] ? ' input-error' : '')}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={e => { updateItem(idx, 'unit_price', e.target.value); setErrors({ ...errors, ['price_' + idx]: null }); }}
                />
                {errors['price_' + idx] && <div className="field-error">{errors['price_' + idx]}</div>}
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Subtotal</label>
                <div className="form-input" style={{ background: 'var(--bg)', color: 'var(--accent)', fontWeight: 700 }}>
                  {formatCurrency((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0))}
                </div>
              </div>
              {orderItems.length > 1 && (
                <button className="btn btn-sm btn-danger" style={{ marginTop: '1.5rem', flexShrink: 0 }} onClick={() => removeItem(idx)}>✕</button>
              )}
            </div>
          ))}

          <div className="billing-total-bar">
            <span>Total</span>
            <strong style={{ fontSize: '1.25rem', color: '#22c55e' }}>{formatCurrency(getTotal())}</strong>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Delivery Address *</label>
            <input
              className={'form-input' + (errors.address ? ' input-error' : '')}
              value={deliveryAddress}
              onChange={e => { setDeliveryAddress(e.target.value); setErrors({ ...errors, address: null }); }}
              placeholder="Enter delivery address"
            />
            {errors.address && <div className="field-error">{errors.address}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Assign Rider *</label>
            <select
              className={'form-input' + (errors.rider ? ' input-error' : '')}
              value={selectedRider}
              onChange={e => { setSelectedRider(e.target.value); setErrors({ ...errors, rider: null }); }}
            >
              <option value="">Select a rider...</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.phone} — {r.is_available ? 'Available' : 'Busy'}
                </option>
              ))}
            </select>
            {errors.rider && <div className="field-error">{errors.rider}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Notes *</label>
            <input
              className={'form-input' + (errors.notes ? ' input-error' : '')}
              value={notes}
              onChange={e => { setNotes(e.target.value); setErrors({ ...errors, notes: null }); }}
              placeholder="e.g. Call before delivery, leave at gate..."
            />
            {errors.notes && <div className="field-error">{errors.notes}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => { if (validateStep2()) setStep(3); }}>Next: Payment →</button>
          </div>
        </div>
      )}

      {/* Step 3 - Payment */}
      {step === 3 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Payment Method</h3>
          </div>

          {errors.payment && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{errors.payment}</div>}

          <div className="billing-payment-options">
            {[
              { value: 'cash', label: 'Cash', icon: '💵', desc: 'Customer pays cash now' },
              { value: 'momo', label: 'MTN MoMo', icon: '📱', desc: 'Mobile money transfer' },
              { value: 'paid_on_delivery', label: 'Pay on Delivery', icon: '🚪', desc: 'Collect cash at doorstep' },
            ].map(opt => (
              <div
                key={opt.value}
                className={'billing-payment-card' + (paymentMethod === opt.value ? ' selected' : '')}
                onClick={() => { setPaymentMethod(opt.value); setErrors({ ...errors, payment: null }); }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{opt.icon}</div>
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{opt.desc}</div>
              </div>
            ))}
          </div>

          {paymentMethod === 'momo' && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong>MTN MoMo Payment Instructions:</strong><br />
                Dial <strong>*170#</strong> → Send Money → Enter number: <strong>0XX XXX XXXX</strong><br />
                Account Name: <strong>Shore Winds</strong><br />
                Amount: <strong>{formatCurrency(getTotal())}</strong>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">MoMo Reference Number *</label>
                <input
                  className={'form-input' + (errors.momo ? ' input-error' : '')}
                  value={momoReference}
                  onChange={e => { setMomoReference(e.target.value); setErrors({ ...errors, momo: null }); }}
                  placeholder="Enter MoMo transaction reference"
                  style={{ background: 'white' }}
                />
                {errors.momo && <div className="field-error">{errors.momo}</div>}
              </div>
            </div>
          )}

          {paymentMethod === 'paid_on_delivery' && (
            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
              <strong>Pay on Delivery selected.</strong> Rider will collect <strong>{formatCurrency(getTotal())}</strong> upon delivery.
            </div>
          )}

          <div className="billing-total-bar" style={{ marginTop: '1.5rem' }}>
            <span>Amount</span>
            <strong style={{ fontSize: '1.4rem', color: '#22c55e' }}>{formatCurrency(getTotal())}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary" onClick={handleStep3Next}>Next: Review →</button>
          </div>
        </div>
      )}

      {/* Step 4 - Review */}
      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Review Order</h3>
          </div>

          <div className="billing-review-grid">
            <div className="billing-review-block">
              <div className="billing-review-label">Customer</div>
              {customerMode === 'existing' ? (
                <div>
                  <div className="billing-review-value">{customers.find(c => c.id === selectedCustomer)?.name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{customers.find(c => c.id === selectedCustomer)?.phone}</div>
                </div>
              ) : (
                <div>
                  <div className="billing-review-value">{newCustomer.name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{newCustomer.phone}</div>
                </div>
              )}
            </div>
            <div className="billing-review-block">
              <div className="billing-review-label">Delivery Address</div>
              <div className="billing-review-value">{deliveryAddress}</div>
            </div>
            <div className="billing-review-block">
              <div className="billing-review-label">Payment</div>
              <div className="billing-review-value">
                {paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'momo' ? '📱 MTN MoMo' : '🚪 Pay on Delivery'}
              </div>
              {paymentMethod === 'momo' && momoReference && (
                <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>Ref: {momoReference}</div>
              )}
            </div>
            <div className="billing-review-block">
              <div className="billing-review-label">Rider</div>
              <div className="billing-review-value">
                {selectedRider ? riders.find(r => r.id === parseInt(selectedRider))?.name : 'Assign later'}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="billing-review-label" style={{ marginBottom: '0.75rem' }}>Items</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.name || products.find(p => p.id === parseInt(item.product_id))?.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td><strong>{formatCurrency((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="billing-total-bar">
            <span>Total Amount</span>
            <strong style={{ fontSize: '1.4rem', color: '#22c55e' }}>{formatCurrency(getTotal())}</strong>
          </div>

          {notes && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              <strong>Notes:</strong> {notes}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>← Back</button>
            <button className="btn btn-success" onClick={handleSubmit} disabled={submitting} style={{ minWidth: '200px' }}>
              {submitting ? 'Creating...' : '🧾 Create Order & Print Receipt'}
            </button>
          </div>
        </div>
      )}
      {/* Cash Payment Confirmation Modal */}
      {showCashConfirm && (
        <div className="modal-overlay" onClick={() => setShowCashConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Cash Payment</h2>
              <button className="modal-close" onClick={() => setShowCashConfirm(false)}>✕</button>
            </div>
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💵</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>Amount to collect</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '1.5rem' }}>
                GHS {parseFloat(getTotal()).toFixed(2)}
              </div>
              <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <strong>Please confirm:</strong> Has the customer paid <strong>GHS {parseFloat(getTotal()).toFixed(2)}</strong> in cash?
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setShowCashConfirm(false)}>
                  ✕ Not Yet
                </button>
                <button className="btn btn-success" onClick={() => { setShowCashConfirm(false); setStep(4); }}>
                  ✓ Yes, Payment Received
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
