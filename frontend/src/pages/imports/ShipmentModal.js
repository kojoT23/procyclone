import React, { useState, useEffect, useMemo } from 'react';
import { importsAPI, productsAPI, inventoryAPI, pricingSettingsAPI } from '../../utils/api';
import ShipmentCharts from './ShipmentCharts';

const CURRENCIES = ['GHS', 'USD', 'CNY', 'EUR', 'GBP', 'AED'];
const fmt = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const emptyItem = () => ({ tempId: Math.random(), product_id: '', product_name: '', quantity_ordered: 1, purchase_unit_price: '', expected_selling_price_per_unit: '', carton_length_cm: '', carton_width_cm: '', carton_height_cm: '', carton_weight_kg: '', cartons_qty: '', hs_code: '' });

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
    expected_arrival: '', notes: '', ucr_number: '', boe_number: '', name: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [costItems, setCostItems] = useState([]);
  const [productSearch, setProductSearch] = useState({}); // { [tempId or id]: search string }
  const [saving, setSaving] = useState(false);

  // ── Duty estimator, embedded — same shape as the standalone tool,
  // now driven by this shipment's real CIF instead of manual entry.
  const [dutyRatePct, setDutyRatePct] = useState(20);
  const [ecowasLevyPct, setEcowasLevyPct] = useState(0.5);
  const [auLevyPct, setAuLevyPct] = useState(0.2);
  const [eximLevyPct, setEximLevyPct] = useState(0.75);
  const [processingFeePct, setProcessingFeePct] = useState(1);
  const [vatPct, setVatPct] = useState(15);
  const [nhilPct, setNhilPct] = useState(2.5);
  const [getfundPct, setGetfundPct] = useState(2.5);
  const [clearingPct, setClearingPct] = useState(3);
  const [clearingMin, setClearingMin] = useState(900);
  const [graRatesLoaded, setGraRatesLoaded] = useState(false);

  // ── Inflation / scenario planner ──
  const [inflationPct, setInflationPct] = useState(10);
  const [scenarioAPrice, setScenarioAPrice] = useState('');
  const [scenarioBPrice, setScenarioBPrice] = useState('');
  const [freightRate, setFreightRate] = useState('');
  const [freightBasis, setFreightBasis] = useState('per_cbm'); // 'per_cbm' | 'per_kg'

  useEffect(() => {
    inventoryAPI.getSuppliers({ limit: 200 }).then(res => setSuppliers(res.data.suppliers || [])).catch(console.error);
    productsAPI.getAll({ limit: 500 }).then(res => setProducts((res.data.products || []).filter(p => p.is_active))).catch(console.error);
    pricingSettingsAPI.get().then(res => {
      const s = res.data.settings || {};
      // Only fall back to Settings defaults for a brand-new shipment.
      // An existing shipment keeps whatever rates it was actually
      // saved with — Settings defaults can change later without
      // silently rewriting historical records.
      if (isEdit) return;
      if (s.default_import_duty_pct != null) setDutyRatePct(parseFloat(s.default_import_duty_pct));
      if (s.default_ecowas_levy_pct != null) setEcowasLevyPct(parseFloat(s.default_ecowas_levy_pct));
      if (s.default_au_levy_pct != null) setAuLevyPct(parseFloat(s.default_au_levy_pct));
      if (s.default_exim_levy_pct != null) setEximLevyPct(parseFloat(s.default_exim_levy_pct));
      if (s.default_processing_fee_pct != null) setProcessingFeePct(parseFloat(s.default_processing_fee_pct));
      if (s.default_vat_pct != null) setVatPct(parseFloat(s.default_vat_pct));
      if (s.default_nhil_pct != null) setNhilPct(parseFloat(s.default_nhil_pct));
      if (s.default_getfund_pct != null) setGetfundPct(parseFloat(s.default_getfund_pct));
      if (s.default_clearing_agent_pct != null) setClearingPct(parseFloat(s.default_clearing_agent_pct));
      if (s.default_clearing_agent_min != null) setClearingMin(parseFloat(s.default_clearing_agent_min));
    }).catch(console.error).finally(() => setGraRatesLoaded(true));
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
        ucr_number: s.ucr_number || '', boe_number: s.boe_number || '', name: s.name || '',
      });
      setItems((s.items || []).map(i => ({
        id: i.id, product_id: i.product_id || '', product_name: i.product_name || i.legacy_description || '',
        quantity_ordered: i.quantity_ordered, purchase_unit_price: i.purchase_unit_price,
        expected_selling_price_per_unit: i.expected_selling_price_per_unit || '',
        carton_length_cm: i.carton_length_cm ?? '', carton_width_cm: i.carton_width_cm ?? '',
        carton_height_cm: i.carton_height_cm ?? '', carton_weight_kg: i.carton_weight_kg ?? '',
        cartons_qty: i.cartons_qty ?? '', hs_code: i.hs_code ?? '',
      })));
      setCostItems(s.cost_items || []);
      if (s.duty_rate_pct != null) setDutyRatePct(parseFloat(s.duty_rate_pct));
      if (s.ecowas_levy_pct != null) setEcowasLevyPct(parseFloat(s.ecowas_levy_pct));
      if (s.au_levy_pct != null) setAuLevyPct(parseFloat(s.au_levy_pct));
      if (s.exim_levy_pct != null) setEximLevyPct(parseFloat(s.exim_levy_pct));
      if (s.processing_fee_pct != null) setProcessingFeePct(parseFloat(s.processing_fee_pct));
      if (s.vat_pct != null) setVatPct(parseFloat(s.vat_pct));
      if (s.nhil_pct != null) setNhilPct(parseFloat(s.nhil_pct));
      if (s.getfund_pct != null) setGetfundPct(parseFloat(s.getfund_pct));
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
  // ── Duty estimator — Ghana Revenue Authority, per the VAT Act 2025
  // (Act 1151) reform effective 1 Jan 2026:
  //   1. Import Duty + ECOWAS + AU + EXIM + Processing Fee are each
  //      calculated on CIF.
  //   2. Those sum with CIF to form the "duty-inclusive value" — the
  //      base every remaining tax is calculated on.
  //   3. VAT, NHIL, and GETFund are each calculated independently on
  //      that SAME duty-inclusive value and simply added together —
  //      they no longer cascade (VAT is not charged on top of
  //      NHIL/GETFund anymore, which is the actual 2026 change).
  // The 1% COVID-19 Health Recovery Levy was abolished in this same
  // reform, so it has no line here at all.
  const estDuty = cif * (dutyRatePct / 100);
  const estEcowas = cif * (ecowasLevyPct / 100);
  const estAu = cif * (auLevyPct / 100);
  const estExim = cif * (eximLevyPct / 100);
  const estProcessingFee = cif * (processingFeePct / 100);
  const dutyInclusiveValue = cif + estDuty + estEcowas + estAu + estExim + estProcessingFee;
  const estVat = dutyInclusiveValue * (vatPct / 100);
  const estNhil = dutyInclusiveValue * (nhilPct / 100);
  const estGetfund = dutyInclusiveValue * (getfundPct / 100);
  const estTotalDutyAndLevies = estDuty + estEcowas + estAu + estExim + estProcessingFee + estVat + estNhil + estGetfund;
  const estClearing = Math.max(cif * (clearingPct / 100), clearingMin);
  const applyDutyEstimate = () => set('customs_duty')(estTotalDutyAndLevies.toFixed(2));
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
          cartons_qty: i.cartons_qty || null, hs_code: i.hs_code || null,
        })),
        cost_items: costItems.filter(c => c.label?.trim()),
        duty_rate_pct: dutyRatePct, ecowas_levy_pct: ecowasLevyPct, au_levy_pct: auLevyPct, exim_levy_pct: eximLevyPct,
        processing_fee_pct: processingFeePct, vat_pct: vatPct, nhil_pct: nhilPct, getfund_pct: getfundPct,
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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? `Edit Shipment #${shipment.id}${shipment.name ? ` — ${shipment.name}` : ''}` : 'New Shipment'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {health && <span style={{ fontSize: 13, fontWeight: 700 }}>{healthLabel[health]}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {finalized && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>This shipment is finalized ({shipment.status}) and can't be edited. Viewing only.</div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Shipment Name (optional)</label>
          <input className="form-input" placeholder="e.g. Xiaomi accessories batch 3" disabled={finalized} value={form.name} onChange={e => set('name')(e.target.value)} />
        </div>

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
            <th style={{ padding: '4px 6px', width: 90 }}>HS Code</th>
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
                  <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ padding: '6px 8px' }} placeholder="e.g. 8471.30" disabled={finalized} value={item.hs_code} onChange={e => updateItem(idx, { hs_code: e.target.value })} /></td>
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
        <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 8 }}>
          CIF for this shipment: <strong>{fmt(cif)}</strong> (product cost + shipping). Rates below are pre-filled from your Settings defaults{graRatesLoaded ? '' : ' (loading…)'} — override any of them per shipment, e.g. for a different HS code or an updated GRA rate.
        </div>
        <table style={{ width: '100%', marginBottom: 8 }}><tbody>
          <tr>
            <td style={{ width: '20%' }}><label className="form-label">Import Duty %</label><input className="form-input" type="number" step="0.1" value={dutyRatePct} onChange={e => setDutyRatePct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">ECOWAS Levy %</label><input className="form-input" type="number" step="0.1" value={ecowasLevyPct} onChange={e => setEcowasLevyPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">AU Levy %</label><input className="form-input" type="number" step="0.1" value={auLevyPct} onChange={e => setAuLevyPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">EXIM Levy %</label><input className="form-input" type="number" step="0.1" value={eximLevyPct} onChange={e => setEximLevyPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Processing Fee %</label><input className="form-input" type="number" step="0.1" value={processingFeePct} onChange={e => setProcessingFeePct(e.target.value)} /></td>
          </tr>
          <tr>
            <td style={{ width: '20%' }}><label className="form-label">VAT %</label><input className="form-input" type="number" step="0.1" value={vatPct} onChange={e => setVatPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">NHIL %</label><input className="form-input" type="number" step="0.1" value={nhilPct} onChange={e => setNhilPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">GETFund %</label><input className="form-input" type="number" step="0.1" value={getfundPct} onChange={e => setGetfundPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Clearing %</label><input className="form-input" type="number" step="0.5" value={clearingPct} onChange={e => setClearingPct(e.target.value)} /></td>
            <td style={{ width: '20%' }}><label className="form-label">Clearing Min (GHS)</label><input className="form-input" type="number" value={clearingMin} onChange={e => setClearingMin(e.target.value)} /></td>
          </tr>
        </tbody></table>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.6 }}>
          Duty {fmt(estDuty)} · ECOWAS {fmt(estEcowas)} · AU {fmt(estAu)} · EXIM {fmt(estExim)} · Processing {fmt(estProcessingFee)} · Duty-inclusive value {fmt(dutyInclusiveValue)} · VAT {fmt(estVat)} · NHIL {fmt(estNhil)} · GETFund {fmt(estGetfund)}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, fontSize: 12 }}>
          <span>Est. Total Duty & Levies: <strong>{fmt(estTotalDutyAndLevies)}</strong></span>
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
            <table style={{ width: '100%', marginBottom: 8 }}><tbody>
              <tr>
                <td style={{ width: '20%' }}><label className="form-label">Actual Shipping</label><input className="form-input" type="number" value={form.actual_shipping_cost} onChange={e => set('actual_shipping_cost')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Duty</label><input className="form-input" type="number" value={form.actual_customs_duty} onChange={e => set('actual_customs_duty')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Clearing</label><input className="form-input" type="number" value={form.actual_clearing_agent_fee} onChange={e => set('actual_clearing_agent_fee')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Inland</label><input className="form-input" type="number" value={form.actual_inland_transport_cost} onChange={e => set('actual_inland_transport_cost')(e.target.value)} /></td>
                <td style={{ width: '20%' }}><label className="form-label">Actual Rate</label><input className="form-input" type="number" step="0.0001" value={form.actual_exchange_rate_used} onChange={e => set('actual_exchange_rate_used')(e.target.value)} /></td>
              </tr>
            </tbody></table>

            {/* ICUMS reference numbers — purely record-keeping. This app
                doesn't talk to ICUMS (no public API exists); these are
                just the reference numbers your clearing agent gives you
                back, kept here for your own reconciliation. */}
            <table style={{ width: '100%', marginBottom: 8 }}><tbody>
              <tr>
                <td style={{ width: '50%' }}><label className="form-label">UCR Number</label><input className="form-input" placeholder="e.g. UCR-GH-..." value={form.ucr_number} onChange={e => set('ucr_number')(e.target.value)} /></td>
                <td style={{ width: '50%' }}><label className="form-label">BOE Number</label><input className="form-input" placeholder="Bill of Entry #" value={form.boe_number} onChange={e => set('boe_number')(e.target.value)} /></td>
              </tr>
            </tbody></table>

            {form.actual_customs_duty !== '' && (
              <div className={`alert ${Math.abs(parseFloat(form.actual_customs_duty) - estTotalDutyAndLevies) > estTotalDutyAndLevies * 0.1 ? 'alert-warning' : 'alert-info'}`} style={{ fontSize: 12, marginBottom: 16 }}>
                Estimated duty & levies: <strong>{fmt(estTotalDutyAndLevies)}</strong> vs actual from GRA/clearing agent: <strong>{fmt(parseFloat(form.actual_customs_duty))}</strong>
                {' '}— variance {fmt(Math.abs(parseFloat(form.actual_customs_duty) - estTotalDutyAndLevies))}
                {estTotalDutyAndLevies > 0 && ` (${((Math.abs(parseFloat(form.actual_customs_duty) - estTotalDutyAndLevies) / estTotalDutyAndLevies) * 100).toFixed(1)}%)`}.
                Adjust your rate defaults in Settings if this keeps drifting the same direction.
              </div>
            )}
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
