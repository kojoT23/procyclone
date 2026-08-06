import React, { useState, useEffect, useMemo } from 'react';
import { importsAPI, productsAPI, inventoryAPI } from '../../utils/api';
import ShipmentCharts from './ShipmentCharts';

const CURRENCIES = ['GHS', 'USD', 'CNY', 'EUR', 'GBP', 'AED'];
const fmt = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const emptyItem = () => ({ tempId: Math.random(), product_id: '', product_name: '', quantity_ordered: 1, purchase_unit_price: '', expected_selling_price_per_unit: '', carton_length_cm: '', carton_width_cm: '', carton_height_cm: '', carton_weight_kg: '', cartons_qty: '' });

export default function ShipmentModal({ shipment, onClose, onSaved }) {
  const isEdit = !!shipment;
  const finalized = shipment && ['received', 'cancelled'].includes(shipment.status);

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  const [form, setForm] = useState({
    supplier_id: '', purchase_currency: 'GHS', exchange_rate_used: 1,
    shipping_cost: 0, customs_duty: 0, clearing_agent_fee: 0, inland_transport_cost: 0, other_fees: 0,
    actual_shipping_cost: '', actual_customs_duty: '', actual_clearing_agent_fee: '',
    actual_inland_transport_cost: '', actual_other_fees: '', actual_exchange_rate_used: '',
    expected_arrival: '', notes: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [costItems, setCostItems] = useState([]);
  const [productSearch, setProductSearch] = useState({}); // { [tempId or id]: search string }
  const [saving, setSaving] = useState(false);

  // ── Duty estimator, embedded — same shape as the standalone tool,
  // now driven by this shipment's real CIF instead of manual entry.
  const [dutyRatePct, setDutyRatePct] = useState(20);
  const [vatLeviesPct, setVatLeviesPct] = useState(21.9);
  const [clearingPct, setClearingPct] = useState(3);
  const [clearingMin, setClearingMin] = useState(900);

  // ── Inflation / scenario planner ──
  const [inflationPct, setInflationPct] = useState(10);
  const [scenarioAPrice, setScenarioAPrice] = useState('');
  const [scenarioBPrice, setScenarioBPrice] = useState('');
  const [freightRate, setFreightRate] = useState('');
  const [freightBasis, setFreightBasis] = useState('per_cbm'); // 'per_cbm' | 'per_kg'

  useEffect(() => {
    inventoryAPI.getSuppliers({ limit: 200 }).then(res => setSuppliers(res.data.suppliers || [])).catch(console.error);
    productsAPI.getAll({ limit: 500 }).then(res => setProducts((res.data.products || []).filter(p => p.is_active))).catch(console.error);
  }, []);

  useEffect(() => {
    if (!shipment) return;
    importsAPI.getOne(shipment.id).then(res => {
      const s = res.data.shipment;
      setForm({
        supplier_id: s.supplier_id || '', purchase_currency: s.purchase_currency, exchange_rate_used: s.exchange_rate_used,
        shipping_cost: s.shipping_cost, customs_duty: s.customs_duty, clearing_agent_fee: s.clearing_agent_fee,
        inland_transport_cost: s.inland_transport_cost, other_fees: s.other_fees,
        actual_shipping_cost: s.actual_shipping_cost ?? '', actual_customs_duty: s.actual_customs_duty ?? '',
        actual_clearing_agent_fee: s.actual_clearing_agent_fee ?? '', actual_inland_transport_cost: s.actual_inland_transport_cost ?? '',
        actual_other_fees: s.actual_other_fees ?? '', actual_exchange_rate_used: s.actual_exchange_rate_used ?? '',
        expected_arrival: s.expected_arrival?.split('T')[0] || '', notes: s.notes || '',
      });
      setItems((s.items || []).map(i => ({
        id: i.id, product_id: i.product_id || '', product_name: i.product_name || i.legacy_description || '',
        quantity_ordered: i.quantity_ordered, purchase_unit_price: i.purchase_unit_price,
        expected_selling_price_per_unit: i.expected_selling_price_per_unit || '',
        carton_length_cm: i.carton_length_cm ?? '', carton_width_cm: i.carton_width_cm ?? '',
        carton_height_cm: i.carton_height_cm ?? '', carton_weight_kg: i.carton_weight_kg ?? '',
        cartons_qty: i.cartons_qty ?? '',
      })));
      setCostItems(s.cost_items || []);
    }).catch(console.error);
  }, [shipment]);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const addCostItem = () => setCostItems(prev => [...prev, { label: '', amount: '' }]);
  const updateCostItem = (idx, patch) => setCostItems(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeCostItem = (idx) => setCostItems(prev => prev.filter((_, i) => i !== idx));

  /* ── Live totals — mirrors the backend's math exactly, so what you
     see while editing matches what gets saved. ── */
  const calc = useMemo(() => {
    const rate = parseFloat(form.exchange_rate_used) || 1;
    const validItems = items.filter(i => i.quantity_ordered > 0);
    const productCostPurchaseCurrency = validItems.reduce((s, i) => s + (parseFloat(i.purchase_unit_price) || 0) * (parseInt(i.quantity_ordered) || 0), 0);
    const productCostGhs = productCostPurchaseCurrency * rate;
    const customItemsTotal = costItems.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    const sharedCosts = (parseFloat(form.shipping_cost) || 0) + (parseFloat(form.customs_duty) || 0) + (parseFloat(form.clearing_agent_fee) || 0) + (parseFloat(form.inland_transport_cost) || 0) + (parseFloat(form.other_fees) || 0) + customItemsTotal;
    const totalLandedCost = productCostGhs + sharedCosts;
    const totalQty = validItems.reduce((s, i) => s + (parseInt(i.quantity_ordered) || 0), 0);
    const blendedUnitCost = totalQty > 0 ? totalLandedCost / totalQty : 0;

    const revenue = validItems.reduce((s, i) => s + (parseFloat(i.expected_selling_price_per_unit) || 0) * (parseInt(i.quantity_ordered) || 0), 0);
    const profit = revenue - totalLandedCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Per-item allocation, mirrors allocateItemCosts on the backend
    const itemBreakdown = validItems.map(i => {
      const itemCostGhs = (parseFloat(i.purchase_unit_price) || 0) * (parseInt(i.quantity_ordered) || 0) * rate;
      const share = productCostGhs > 0 ? (itemCostGhs / productCostGhs) * sharedCosts : 0;
      const allocated = itemCostGhs + share;
      const qty = parseInt(i.quantity_ordered) || 0;
      const unitCost = qty > 0 ? allocated / qty : 0;
      const sellingPrice = parseFloat(i.expected_selling_price_per_unit) || 0;
      return { ...i, allocatedCost: allocated, unitCost, profitPerUnit: sellingPrice - unitCost };
    });

    return { productCostGhs, sharedCosts, totalLandedCost, totalQty, blendedUnitCost, revenue, profit, margin, itemBreakdown, customItemsTotal };
  }, [items, costItems, form.exchange_rate_used, form.shipping_cost, form.customs_duty, form.clearing_agent_fee, form.inland_transport_cost, form.other_fees]);

  const health = calc.revenue <= 0 ? null : calc.margin > 40 ? 'excellent' : calc.margin >= 25 ? 'good' : calc.margin >= 10 ? 'low' : 'loss';
  const healthLabel = { excellent: '🟢 Excellent', good: '🟡 Good', low: '🟠 Low', loss: '🔴 Loss' };

  // ── Freight calculator — CBM/weight x the forwarder's rate, entered
  // per item as L x W x H (cm), weight per carton, and carton count.
  // Purely a helper: it computes a suggested number and, on request,
  // writes it into the existing shipping_cost field. Nothing here is
  // required — items left blank just don't contribute.
  const freightCalc = useMemo(() => {
    let totalCbm = 0;
    let totalWeightKg = 0;
    for (const i of items) {
      const l = parseFloat(i.carton_length_cm) || 0;
      const w = parseFloat(i.carton_width_cm) || 0;
      const h = parseFloat(i.carton_height_cm) || 0;
      const wt = parseFloat(i.carton_weight_kg) || 0;
      const cartons = parseInt(i.cartons_qty) || 0;
      totalCbm += (l * w * h / 1_000_000) * cartons;
      totalWeightKg += wt * cartons;
    }
    const rate = parseFloat(freightRate) || 0;
    const computedFreight = freightBasis === 'per_cbm' ? totalCbm * rate : totalWeightKg * rate;
    return { totalCbm, totalWeightKg, computedFreight };
  }, [items, freightRate, freightBasis]);

  // ── Duty estimator ──
  const cif = calc.productCostGhs + (parseFloat(form.shipping_cost) || 0);
  const estDuty = cif * (dutyRatePct / 100);
  const estVatLevies = (cif + estDuty) * (vatLeviesPct / 100);
  const estClearing = Math.max(cif * (clearingPct / 100), clearingMin);
  const applyDutyEstimate = () => set('customs_duty')((estDuty + estVatLevies).toFixed(2));
  const applyClearingEstimate = () => set('clearing_agent_fee')(estClearing.toFixed(2));

  // ── Inflation / scenario planner — the 3 pricing-protection strategies ──
  const scenarios = useMemo(() => {
    const currentCost = calc.blendedUnitCost;
    const newCost = currentCost * (1 + inflationPct / 100);
    const priceA = parseFloat(scenarioAPrice) || 0;
    const priceB = parseFloat(scenarioBPrice) || 0;
    const currentMargin = priceA > 0 ? (priceA - currentCost) / priceA : 0;
    const currentMarkup = currentCost > 0 ? (priceA - currentCost) / currentCost : 0;
    const oldProfitPerUnit = priceA - currentCost;

    return {
      currentCost, newCost,
      marginProtect: currentMargin > 0 ? newCost / (1 - currentMargin) : null,
      profitProtect: newCost + oldProfitPerUnit,
      markupProtect: newCost * (1 + currentMarkup),
      scenarioA: priceA > 0 ? { price: priceA, profit: priceA - currentCost, margin: ((priceA - currentCost) / priceA) * 100 } : null,
      scenarioB: priceB > 0 ? { price: priceB, profit: priceB - currentCost, margin: ((priceB - currentCost) / priceB) * 100 } : null,
    };
  }, [calc.blendedUnitCost, inflationPct, scenarioAPrice, scenarioBPrice]);

  const handleQuickAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const res = await inventoryAPI.createSupplier({ name: newSupplierName.trim() });
      const newSup = res.data.supplier;
      setSuppliers(prev => [...prev, newSup]);
      set('supplier_id')(newSup.id);
      setNewSupplierName('');
      setShowNewSupplier(false);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not add supplier');
    }
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.quantity_ordered > 0);
    if (validItems.length === 0) return alert('Add at least one product');
    if (validItems.some(i => !i.product_id)) return alert('Every row needs a product selected — search and pick one');
    if (form.purchase_currency !== 'GHS' && (!form.exchange_rate_used || form.exchange_rate_used <= 0)) {
      return alert('Enter the exchange rate used for this currency');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: validItems.map(i => ({
          product_id: i.product_id, quantity_ordered: parseInt(i.quantity_ordered),
          purchase_unit_price: parseFloat(i.purchase_unit_price) || 0,
          expected_selling_price_per_unit: i.expected_selling_price_per_unit ? parseFloat(i.expected_selling_price_per_unit) : null,
          carton_length_cm: i.carton_length_cm || null, carton_width_cm: i.carton_width_cm || null,
          carton_height_cm: i.carton_height_cm || null, carton_weight_kg: i.carton_weight_kg || null,
          cartons_qty: i.cartons_qty || null,
        })),
        cost_items: costItems.filter(c => c.label?.trim()),
      };
      const res = isEdit ? await importsAPI.update(shipment.id, payload) : await importsAPI.create(payload);
      if (res.data.success) { onSaved(); onClose(); }
      else alert(res.data.message);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save shipment');
    } finally {
      setSaving(false);
    }
  };

  const productMatches = (q) => !q?.trim() ? [] : products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'calc(100vw - 64px)', width: '1400px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? `Edit Shipment #${shipment.id}` : 'New Shipment'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {health && <span style={{ fontSize: 13, fontWeight: 700 }}>{healthLabel[health]}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {finalized && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>This shipment is finalized ({shipment.status}) and can't be edited. Viewing only.</div>
        )}

        {/* ── Supplier + currency ── */}
        <table style={{ width: '100%', marginBottom: 16 }}><tbody>
          <tr>
            <td style={{ width: '50%', paddingRight: 10, verticalAlign: 'top' }}>
              <label className="form-label">Supplier</label>
              {!showNewSupplier ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="form-input" disabled={finalized} value={form.supplier_id} onChange={e => set('supplier_id')(e.target.value)}>
                    <option value="">Select supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ''}</option>)}
                  </select>
                  {!finalized && <button className="btn" onClick={() => setShowNewSupplier(true)}>+ New</button>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" placeholder="New supplier name" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} />
                  <button className="btn btn-primary" onClick={handleQuickAddSupplier}>Add</button>
                  <button className="btn" onClick={() => setShowNewSupplier(false)}>✕</button>
                </div>
              )}
            </td>
            <td style={{ width: '25%', paddingRight: 10, verticalAlign: 'top' }}>
              <label className="form-label">Currency</label>
              <select className="form-input" disabled={finalized} value={form.purchase_currency} onChange={e => set('purchase_currency')(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </td>
            <td style={{ width: '25%', verticalAlign: 'top' }}>
              <label className="form-label">Exchange Rate {form.purchase_currency !== 'GHS' && '*'}</label>
              <input className="form-input" type="number" step="0.0001" disabled={finalized || form.purchase_currency === 'GHS'}
                value={form.purchase_currency === 'GHS' ? 1 : form.exchange_rate_used} onChange={e => set('exchange_rate_used')(e.target.value)} />
            </td>
          </tr>
        </tbody></table>

        {/* ── Product line items ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Products</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead><tr style={{ fontSize: 11, color: '#6b7280', textAlign: 'left' }}>
            <th style={{ padding: '4px 6px' }}>Product</th>
            <th style={{ padding: '4px 6px', width: 80 }}>Qty</th>
            <th style={{ padding: '4px 6px', width: 110 }}>Unit Price ({form.purchase_currency})</th>
            <th style={{ padding: '4px 6px', width: 110 }}>Sell Price (GHS)</th>
            <th style={{ padding: '4px 6px', width: 90 }}>Landed Cost/Unit</th>
            <th style={{ padding: '4px 6px', width: 90 }}>Profit/Unit</th>
            <th style={{ padding: '4px 6px', width: 130 }}>L×W×H (cm)</th>
            <th style={{ padding: '4px 6px', width: 80 }}>Wt/Carton (kg)</th>
            <th style={{ padding: '4px 6px', width: 70 }}>Cartons</th>
            <th style={{ width: 30 }}></th>
          </tr></thead>
          <tbody>
            {items.map((item, idx) => {
              const breakdown = calc.itemBreakdown[idx];
              const key = item.id || item.tempId;
              const search = productSearch[key] || '';
              return (
                <tr key={key} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 6px', position: 'relative' }}>
                    {item.product_id ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13 }}>{item.product_name}</span>
                        {!finalized && <button onClick={() => updateItem(idx, { product_id: '', product_name: '' })} style={{ background: 'none', border: 'none', fontSize: 11, color: '#2563eb', cursor: 'pointer' }}>change</button>}
                      </div>
                    ) : (
                      <div>
                        <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} placeholder="Search product…" value={search}
                          onChange={e => setProductSearch(prev => ({ ...prev, [key]: e.target.value }))} disabled={finalized} />
                        {search && (
                          <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, width: '100%', maxHeight: 180, overflowY: 'auto' }}>
                            {productMatches(search).map(p => (
                              <div key={p.id} onClick={() => { updateItem(idx, { product_id: p.id, product_name: p.name }); setProductSearch(prev => ({ ...prev, [key]: '' })); }}
                                style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                                {p.name} <span style={{ color: '#9ca3af' }}>· stock {p.stock_quantity}</span>
                              </div>
                            ))}
                            {productMatches(search).length === 0 && <div style={{ padding: 8, fontSize: 12, color: '#9ca3af' }}>No matches</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" min="1" disabled={finalized} value={item.quantity_ordered} onChange={e => updateItem(idx, { quantity_ordered: e.target.value })} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" step="0.01" disabled={finalized} value={item.purchase_unit_price} onChange={e => updateItem(idx, { purchase_unit_price: e.target.value })} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" step="0.01" disabled={finalized} value={item.expected_selling_price_per_unit} onChange={e => updateItem(idx, { expected_selling_price_per_unit: e.target.value })} /></td>
                  <td style={{ padding: '4px 6px', fontSize: 12, color: '#6b7280' }}>{breakdown ? fmt(breakdown.unitCost) : '—'}</td>
                  <td style={{ padding: '4px 6px', fontSize: 12, fontWeight: 700, color: breakdown && breakdown.profitPerUnit >= 0 ? '#16a34a' : '#ef4444' }}>{breakdown ? fmt(breakdown.profitPerUnit) : '—'}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <input className="form-input" style={{ padding: '6px 4px', width: 36, fontSize: 11 }} type="number" placeholder="L" disabled={finalized} value={item.carton_length_cm} onChange={e => updateItem(idx, { carton_length_cm: e.target.value })} />
                      <input className="form-input" style={{ padding: '6px 4px', width: 36, fontSize: 11 }} type="number" placeholder="W" disabled={finalized} value={item.carton_width_cm} onChange={e => updateItem(idx, { carton_width_cm: e.target.value })} />
                      <input className="form-input" style={{ padding: '6px 4px', width: 36, fontSize: 11 }} type="number" placeholder="H" disabled={finalized} value={item.carton_height_cm} onChange={e => updateItem(idx, { carton_height_cm: e.target.value })} />
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" step="0.01" disabled={finalized} value={item.carton_weight_kg} onChange={e => updateItem(idx, { carton_weight_kg: e.target.value })} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" min="0" disabled={finalized} value={item.cartons_qty} onChange={e => updateItem(idx, { cartons_qty: e.target.value })} /></td>
                  <td>{!finalized && items.length > 1 && <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!finalized && <button className="btn btn-sm" onClick={addItem}>+ Add Product</button>}

        {/* ── Freight calculator (CBM/weight x forwarder rate) ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', margin: '16px 0 8px' }}>Freight Calculator</div>
        <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 8 }}>
          Fill in L×W×H, weight/carton, and cartons per product above (optional). Enter your forwarder's rate below to get a suggested shipping cost — it won't overwrite anything until you click "Use as Shipping Cost."
        </div>
        <table style={{ width: '100%', marginBottom: 8 }}><tbody>
          <tr>
            <td style={{ width: '20%' }}><label className="form-label">Total CBM</label><div style={{ padding: '8px 0', fontSize: 13, fontWeight: 700 }}>{freightCalc.totalCbm.toFixed(3)}</div></td>
            <td style={{ width: '20%' }}><label className="form-label">Total Weight (kg)</label><div style={{ padding: '8px 0', fontSize: 13, fontWeight: 700 }}>{freightCalc.totalWeightKg.toFixed(1)}</div></td>
            <td style={{ width: '20%' }}><label className="form-label">Rate Basis</label>
              <select className="form-input" value={freightBasis} onChange={e => setFreightBasis(e.target.value)}>
                <option value="per_cbm">Per CBM</option>
                <option value="per_kg">Per Kg</option>
              </select>
            </td>
            <td style={{ width: '20%' }}><label className="form-label">Rate (GHS per {freightBasis === 'per_cbm' ? 'CBM' : 'kg'})</label><input className="form-input" type="number" step="0.01" value={freightRate} onChange={e => setFreightRate(e.target.value)} /></td>
            <td style={{ width: '20%' }}>
              <label className="form-label">Computed Freight</label>
              <div style={{ padding: '8px 0', fontSize: 13, fontWeight: 700 }}>{fmt(freightCalc.computedFreight)}</div>
            </td>
          </tr>
        </tbody></table>
        {!finalized && (
          <button className="btn btn-sm" style={{ marginBottom: 8 }} onClick={() => set('shipping_cost')(freightCalc.computedFreight.toFixed(2))}>
            Use as Shipping Cost
          </button>
        )}

        {/* ── Ghana duty & levy estimator ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', margin: '16px 0 8px' }}>Ghana Duty & Levy Estimator</div>
        <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 8 }}>CIF for this shipment: <strong>{fmt(cif)}</strong> (product cost + shipping). Verify current rates with GRA/your clearing agent — these are editable defaults.</div>
        <table style={{ width: '100%', marginBottom: 8 }}><tbody>
          <tr>
            <td style={{ width: '25%' }}><label className="form-label">Duty %</label><input className="form-input" type="number" step="0.5" value={dutyRatePct} onChange={e => setDutyRatePct(e.target.value)} /></td>
            <td style={{ width: '25%' }}><label className="form-label">VAT+NHIL+GETFund %</label><input className="form-input" type="number" step="0.1" value={vatLeviesPct} onChange={e => setVatLeviesPct(e.target.value)} /></td>
            <td style={{ width: '25%' }}><label className="form-label">Clearing %</label><input className="form-input" type="number" step="0.5" value={clearingPct} onChange={e => setClearingPct(e.target.value)} /></td>
            <td style={{ width: '25%' }}><label className="form-label">Clearing Min (GHS)</label><input className="form-input" type="number" value={clearingMin} onChange={e => setClearingMin(e.target.value)} /></td>
          </tr>
        </tbody></table>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, fontSize: 12 }}>
          <span>Est. Duty+VAT/Levies: <strong>{fmt(estDuty + estVatLevies)}</strong></span>
          {!finalized && <button className="btn btn-sm" onClick={applyDutyEstimate}>Apply to Customs Duty field →</button>}
          <span>Est. Clearing: <strong>{fmt(estClearing)}</strong></span>
          {!finalized && <button className="btn btn-sm" onClick={applyClearingEstimate}>Apply to Clearing field →</button>}
        </div>

        {/* ── Shared shipment costs ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Shared Shipment Costs (GHS)</div>
        <table style={{ width: '100%', marginBottom: 16 }}><tbody>
          <tr>
            <td style={{ width: '20%' }}><label className="form-label">Shipping</label><input className="form-input" type="number" disabled={finalized} value={form.shipping_cost} onChange={e => set('shipping_cost')(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Customs Duty</label><input className="form-input" type="number" disabled={finalized} value={form.customs_duty} onChange={e => set('customs_duty')(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Clearing Fee</label><input className="form-input" type="number" disabled={finalized} value={form.clearing_agent_fee} onChange={e => set('clearing_agent_fee')(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Inland Transport</label><input className="form-input" type="number" disabled={finalized} value={form.inland_transport_cost} onChange={e => set('inland_transport_cost')(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Other</label><input className="form-input" type="number" disabled={finalized} value={form.other_fees} onChange={e => set('other_fees')(e.target.value)} /></td>
          </tr>
        </tbody></table>

        {isEdit && !finalized && shipment.status !== 'planning' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Actual Costs (fill in as confirmed)</div>
            <table style={{ width: '100%', marginBottom: 16 }}><tbody>
              <tr>
                <td style={{ width: '20%' }}><label className="form-label">Actual Shipping</label><input className="form-input" type="number" value={form.actual_shipping_cost} onChange={e => set('actual_shipping_cost')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Duty</label><input className="form-input" type="number" value={form.actual_customs_duty} onChange={e => set('actual_customs_duty')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Clearing</label><input className="form-input" type="number" value={form.actual_clearing_agent_fee} onChange={e => set('actual_clearing_agent_fee')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Inland</label><input className="form-input" type="number" value={form.actual_inland_transport_cost} onChange={e => set('actual_inland_transport_cost')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Rate</label><input className="form-input" type="number" step="0.0001" value={form.actual_exchange_rate_used} onChange={e => set('actual_exchange_rate_used')(e.target.value)} /></td>
              </tr>
            </tbody></table>
          </>
        )}

        {/* ── Custom cost rows ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Custom Cost Rows</div>
        <table style={{ width: '100%', marginBottom: 8 }}><tbody>
          {costItems.map((c, idx) => (
            <tr key={idx}>
              <td style={{ padding: '3px 6px 3px 0' }}><input className="form-input" style={{ padding: '6px 8px' }} placeholder="Label (e.g. Bank charges)" disabled={finalized} value={c.label} onChange={e => updateCostItem(idx, { label: e.target.value })} /></td>
              <td style={{ padding: '3px 6px', width: 140 }}><input className="form-input" style={{ padding: '6px 8px' }} type="number" placeholder="Amount" disabled={finalized} value={c.amount} onChange={e => updateCostItem(idx, { amount: e.target.value })} /></td>
              <td style={{ width: 30 }}>{!finalized && <button onClick={() => removeCostItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}</td>
            </tr>
          ))}
        </tbody></table>
        {!finalized && <button className="btn btn-sm" onClick={addCostItem}>+ Add Cost Row</button>}

        {/* ── Live totals ── */}
        <table style={{ width: '100%', margin: '16px 0', background: '#f9fafb', borderRadius: 8 }}><tbody>
          <tr>
            <td style={{ padding: 10 }}>Total Landed Cost</td><td style={{ padding: 10, fontWeight: 700 }}>{fmt(calc.totalLandedCost)}</td>
            <td style={{ padding: 10 }}>Blended Unit Cost</td><td style={{ padding: 10, fontWeight: 700 }}>{fmt(calc.blendedUnitCost)}</td>
          </tr>
          <tr>
            <td style={{ padding: 10 }}>Projected Revenue</td><td style={{ padding: 10, fontWeight: 700 }}>{fmt(calc.revenue)}</td>
            <td style={{ padding: 10 }}>Projected Profit</td><td style={{ padding: 10, fontWeight: 700, color: calc.profit >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(calc.profit)} ({calc.margin.toFixed(1)}%)</td>
          </tr>
        </tbody></table>

        {/* ── Inflation / scenario planner ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Pricing Scenarios & Inflation Planner</div>
        <table style={{ width: '100%', marginBottom: 8 }}><tbody>
          <tr>
            <td style={{ width: '25%' }}><label className="form-label">Scenario A price</label><input className="form-input" type="number" value={scenarioAPrice} onChange={e => setScenarioAPrice(e.target.value)} /></td>
            <td style={{ width: '25%' }}><label className="form-label">Scenario B price</label><input className="form-input" type="number" value={scenarioBPrice} onChange={e => setScenarioBPrice(e.target.value)} /></td>
            <td style={{ width: '25%' }}><label className="form-label">Assume cost rises by %</label><input className="form-input" type="number" value={inflationPct} onChange={e => setInflationPct(e.target.value)} /></td>
            <td style={{ width: '25%' }}></td>
          </tr>
        </tbody></table>
        <table style={{ width: '100%', fontSize: 12, marginBottom: 16 }}>
          <thead><tr style={{ color: '#6b7280', textAlign: 'left' }}>
            <th style={{ padding: '4px 6px' }}>Comparison</th><th>Price</th><th>Profit/Unit</th><th>Margin</th>
          </tr></thead>
          <tbody>
            <tr style={{ borderTop: '1px solid #f3f4f6' }}><td style={{ padding: '6px' }}>Current blended cost</td><td>{fmt(calc.blendedUnitCost)}</td><td>—</td><td>—</td></tr>
            {scenarios.scenarioA && <tr style={{ borderTop: '1px solid #f3f4f6' }}><td style={{ padding: '6px' }}>Scenario A</td><td>{fmt(scenarios.scenarioA.price)}</td><td>{fmt(scenarios.scenarioA.profit)}</td><td>{scenarios.scenarioA.margin.toFixed(1)}%</td></tr>}
            {scenarios.scenarioB && <tr style={{ borderTop: '1px solid #f3f4f6' }}><td style={{ padding: '6px' }}>Scenario B</td><td>{fmt(scenarios.scenarioB.price)}</td><td>{fmt(scenarios.scenarioB.profit)}</td><td>{scenarios.scenarioB.margin.toFixed(1)}%</td></tr>}
            <tr style={{ borderTop: '2px solid #e5e7eb' }}><td colSpan={4} style={{ padding: '8px 6px 2px', fontWeight: 700, color: '#6b7280' }}>If cost rises {inflationPct}% (new cost {fmt(scenarios.newCost)}) — needs Scenario A price set:</td></tr>
            <tr><td style={{ padding: '6px' }}>Protect margin %</td><td colSpan={3}>{scenarios.marginProtect ? fmt(scenarios.marginProtect) : '— set Scenario A price'}</td></tr>
            <tr><td style={{ padding: '6px' }}>Protect profit/unit</td><td colSpan={3}>{scenarios.scenarioA ? fmt(scenarios.profitProtect) : '— set Scenario A price'}</td></tr>
            <tr><td style={{ padding: '6px' }}>Protect markup %</td><td colSpan={3}>{scenarios.scenarioA ? fmt(scenarios.markupProtect) : '— set Scenario A price'}</td></tr>
          </tbody>
        </table>

        {/* ── Arrival + notes ── */}
        <table style={{ width: '100%', marginBottom: 16 }}><tbody>
          <tr>
            <td style={{ width: '30%' }}><label className="form-label">Expected Arrival</label><input className="form-input" type="date" disabled={finalized} value={form.expected_arrival} onChange={e => set('expected_arrival')(e.target.value)} /></td>
            <td style={{ width: '70%' }}><label className="form-label">Notes</label><input className="form-input" disabled={finalized} value={form.notes} onChange={e => set('notes')(e.target.value)} /></td>
          </tr>
        </tbody></table>

        {/* ── Charts ── */}
        <ShipmentCharts
          productCostGhs={calc.productCostGhs}
          shippingCost={parseFloat(form.shipping_cost) || 0}
          customsDuty={parseFloat(form.customs_duty) || 0}
          localCosts={(parseFloat(form.clearing_agent_fee) || 0) + (parseFloat(form.inland_transport_cost) || 0)}
          otherFees={(parseFloat(form.other_fees) || 0) + calc.customItemsTotal}
          totalLandedCost={calc.totalLandedCost}
          projectedRevenue={calc.revenue}
          projectedProfit={calc.profit}
        />

        {!finalized && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update Shipment' : 'Create Shipment'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
