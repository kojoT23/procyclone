import React, { useState, useEffect, useCallback } from 'react';
import { pricingSettingsAPI, deliveryZonesAPI, surchargeRulesAPI, discountRulesAPI } from '../utils/api';

/* ═══════════════════════════════════════════════════════════════════
   DELIVERY & PRICING TAB
   Manages: free delivery threshold, manual discount cap, surcharge
   overlap mode, delivery zones, surcharge rules, and automatic
   discount rules. All writes are super_admin only.
═══════════════════════════════════════════════════════════════════ */
const DeliveryPricingTab = ({ currentUser }) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [loading, setLoading] = useState(true);

  /* ── General settings state ──────────────────────────────────── */
  const [settings, setSettings] = useState({
    free_delivery_threshold: '',
    max_manual_discount: '0',
    max_manual_discount_type: 'fixed',
    surcharge_overlap_mode: 'highest',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved,  setSettingsSaved]  = useState(false);
  const [settingsErrors, setSettingsErrors] = useState({});

  /* ── Zones state ──────────────────────────────────────────────── */
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState(null); // null = no form open, object = editing/creating
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState('');

  /* ── Surcharge rules state ───────────────────────────────────── */
  const [surchargeRules, setSurchargeRules] = useState([]);
  const [surchargeForm, setSurchargeForm] = useState(null);
  const [surchargeSaving, setSurchargeSaving] = useState(false);
  const [surchargeError, setSurchargeError] = useState('');

  /* ── Discount rules state ────────────────────────────────────── */
  const [discountRules, setDiscountRules] = useState([]);
  const [discountForm, setDiscountForm] = useState(null);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ── Fetch everything once on mount ──────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, zonesRes, surchargeRes, discountRes] = await Promise.all([
        pricingSettingsAPI.get(),
        deliveryZonesAPI.getAll(),
        surchargeRulesAPI.getAll(),
        discountRulesAPI.getAll(),
      ]);
      const s = settingsRes.data.settings;
      setSettings({
        free_delivery_threshold: s.free_delivery_threshold ?? '',
        max_manual_discount: String(s.max_manual_discount ?? '0'),
        max_manual_discount_type: s.max_manual_discount_type || 'fixed',
        surcharge_overlap_mode: s.surcharge_overlap_mode || 'highest',
      });
      setZones(zonesRes.data.zones || []);
      setSurchargeRules(surchargeRes.data.rules || []);
      setDiscountRules(discountRes.data.rules || []);
    } catch (err) {
      console.error('Failed to load delivery/pricing settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── General settings handlers ───────────────────────────────── */
  const handleSettingsChange = (field) => (e) => {
    setSettings(s => ({ ...s, [field]: e.target.value }));
    setSettingsSaved(false);
  };

  const validateSettings = () => {
    const errs = {};
    const maxDiscount = parseFloat(settings.max_manual_discount);
    if (isNaN(maxDiscount) || maxDiscount < 0) {
      errs.max_manual_discount = 'Enter a valid positive number';
    }
    if (settings.free_delivery_threshold !== '' &&
        (isNaN(parseFloat(settings.free_delivery_threshold)) || parseFloat(settings.free_delivery_threshold) < 0)) {
      errs.free_delivery_threshold = 'Enter a valid positive number, or leave blank for no free delivery offer';
    }
    return errs;
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    const errs = validateSettings();
    if (Object.keys(errs).length > 0) {
      setSettingsErrors(errs);
      return;
    }

    setSettingsSaving(true);
    setSettingsErrors({});
    setSettingsSaved(false);
    try {
      await pricingSettingsAPI.update({
        free_delivery_threshold: settings.free_delivery_threshold === '' ? null : parseFloat(settings.free_delivery_threshold),
        max_manual_discount: parseFloat(settings.max_manual_discount),
        max_manual_discount_type: settings.max_manual_discount_type,
        surcharge_overlap_mode: settings.surcharge_overlap_mode,
      });
      setSettingsSaved(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving pricing settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  /* ── Zone handlers ────────────────────────────────────────────── */
  const openNewZoneForm = () => {
    setZoneForm({ id: null, name: '', fee: '', min_order_amount: '0', is_active: true });
    setZoneError('');
  };

  const openEditZoneForm = (zone) => {
    setZoneForm({
      id: zone.id,
      name: zone.name,
      fee: String(zone.fee),
      min_order_amount: String(zone.min_order_amount || 0),
      is_active: zone.is_active,
    });
    setZoneError('');
  };

  const handleZoneSave = async () => {
    if (!zoneForm.name.trim()) {
      setZoneError('Zone name is required');
      return;
    }
    const fee = parseFloat(zoneForm.fee);
    if (isNaN(fee) || fee < 0) {
      setZoneError('Enter a valid fee amount');
      return;
    }
    const minOrder = parseFloat(zoneForm.min_order_amount) || 0;

    setZoneSaving(true);
    setZoneError('');
    try {
      if (zoneForm.id) {
        await deliveryZonesAPI.update(zoneForm.id, {
          name: zoneForm.name, fee, min_order_amount: minOrder, is_active: zoneForm.is_active,
        });
      } else {
        await deliveryZonesAPI.create({ name: zoneForm.name, fee, min_order_amount: minOrder });
      }
      setZoneForm(null);
      fetchAll();
    } catch (err) {
      setZoneError(err.response?.data?.message || 'Error saving zone');
    } finally {
      setZoneSaving(false);
    }
  };

  const handleZoneDelete = async (zone) => {
    if (!window.confirm(`Deactivate "${zone.name}"? It will no longer appear as an option for new orders.`)) return;
    try {
      await deliveryZonesAPI.delete(zone.id);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deactivating zone');
    }
  };

  /* ── Surcharge rule handlers ─────────────────────────────────── */
  const openNewSurchargeForm = () => {
    setSurchargeForm({
      id: null, label: '', day_of_week: '', start_time: '20:00', end_time: '02:00',
      surcharge_type: 'fixed', surcharge_value: '', is_active: true,
    });
    setSurchargeError('');
  };

  const openEditSurchargeForm = (rule) => {
    setSurchargeForm({
      id: rule.id,
      label: rule.label,
      day_of_week: rule.day_of_week === null ? '' : String(rule.day_of_week),
      start_time: rule.start_time?.slice(0, 5) || '20:00',
      end_time: rule.end_time?.slice(0, 5) || '02:00',
      surcharge_type: rule.surcharge_type,
      surcharge_value: String(rule.surcharge_value),
      is_active: rule.is_active,
    });
    setSurchargeError('');
  };

  const handleSurchargeSave = async () => {
    if (!surchargeForm.label.trim()) {
      setSurchargeError('Label is required');
      return;
    }
    const value = parseFloat(surchargeForm.surcharge_value);
    if (isNaN(value) || value < 0) {
      setSurchargeError('Enter a valid surcharge value');
      return;
    }

    setSurchargeSaving(true);
    setSurchargeError('');
    try {
      const payload = {
        label: surchargeForm.label,
        day_of_week: surchargeForm.day_of_week === '' ? null : parseInt(surchargeForm.day_of_week),
        start_time: surchargeForm.start_time,
        end_time: surchargeForm.end_time,
        surcharge_type: surchargeForm.surcharge_type,
        surcharge_value: value,
        is_active: surchargeForm.is_active,
      };
      if (surchargeForm.id) {
        await surchargeRulesAPI.update(surchargeForm.id, payload);
      } else {
        await surchargeRulesAPI.create(payload);
      }
      setSurchargeForm(null);
      fetchAll();
    } catch (err) {
      setSurchargeError(err.response?.data?.message || 'Error saving surcharge rule');
    } finally {
      setSurchargeSaving(false);
    }
  };

  const handleSurchargeDelete = async (rule) => {
    if (!window.confirm(`Delete surcharge rule "${rule.label}"? This cannot be undone.`)) return;
    try {
      await surchargeRulesAPI.delete(rule.id);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting surcharge rule');
    }
  };

  /* ── Discount rule handlers ──────────────────────────────────── */
  const openNewDiscountForm = () => {
    setDiscountForm({ id: null, label: '', discount_type: 'percent', discount_value: '', min_order_amount: '0', is_active: true });
    setDiscountError('');
  };

  const openEditDiscountForm = (rule) => {
    setDiscountForm({
      id: rule.id,
      label: rule.label,
      discount_type: rule.discount_type,
      discount_value: String(rule.discount_value),
      min_order_amount: String(rule.min_order_amount || 0),
      is_active: rule.is_active,
    });
    setDiscountError('');
  };

  const handleDiscountSave = async () => {
    if (!discountForm.label.trim()) {
      setDiscountError('Label is required');
      return;
    }
    const value = parseFloat(discountForm.discount_value);
    if (isNaN(value) || value < 0) {
      setDiscountError('Enter a valid discount value');
      return;
    }

    setDiscountSaving(true);
    setDiscountError('');
    try {
      const payload = {
        label: discountForm.label,
        discount_type: discountForm.discount_type,
        discount_value: value,
        min_order_amount: parseFloat(discountForm.min_order_amount) || 0,
        is_active: discountForm.is_active,
      };
      if (discountForm.id) {
        await discountRulesAPI.update(discountForm.id, payload);
      } else {
        await discountRulesAPI.create(payload);
      }
      setDiscountForm(null);
      fetchAll();
    } catch (err) {
      setDiscountError(err.response?.data?.message || 'Error saving discount rule');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleDiscountDelete = async (rule) => {
    if (!window.confirm(`Delete discount rule "${rule.label}"? This cannot be undone.`)) return;
    try {
      await discountRulesAPI.delete(rule.id);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting discount rule');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span className="loading-text">Loading delivery & pricing settings…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ══════════════════ Card 1: General Settings ══════════════════ */}
      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>
          General Pricing Settings
        </h3>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 20px' }}>
          Controls that apply across all orders, regardless of zone.
        </p>

        {!isSuperAdmin && (
          <div className="alert alert-info" style={{ marginBottom: '16px' }}>
            Only a super admin can edit these settings. You can view them below.
          </div>
        )}

        {settingsSaved && (
          <div className="alert alert-success" style={{ marginBottom: '16px' }}>
            ✓ Pricing settings saved.
          </div>
        )}

        <form onSubmit={handleSettingsSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                Free Delivery Threshold (GH₵)
                <span style={{ color: 'var(--text-3)', fontWeight: '400', marginLeft: '4px' }}>
                  — leave blank to disable
                </span>
              </label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={settings.free_delivery_threshold}
                onChange={handleSettingsChange('free_delivery_threshold')}
                disabled={!isSuperAdmin}
                placeholder="e.g. 200"
              />
              {settingsErrors.free_delivery_threshold && (
                <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
                  {settingsErrors.free_delivery_threshold}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Max Manual Discount (cashier/manager cap)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={settings.max_manual_discount}
                  onChange={handleSettingsChange('max_manual_discount')}
                  disabled={!isSuperAdmin}
                  style={{ flex: 1 }}
                />
                <select
                  className="form-input"
                  value={settings.max_manual_discount_type}
                  onChange={handleSettingsChange('max_manual_discount_type')}
                  disabled={!isSuperAdmin}
                  style={{ width: '110px' }}
                >
                  <option value="fixed">GH₵</option>
                  <option value="percent">%</option>
                </select>
              </div>
              {settingsErrors.max_manual_discount && (
                <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
                  {settingsErrors.max_manual_discount}
                </p>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="form-label">
              If Surcharge Rules Overlap
              <span style={{ color: 'var(--text-3)', fontWeight: '400', marginLeft: '4px' }}>
                — when two active surcharge rules apply at the same time
              </span>
            </label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: isSuperAdmin ? 'pointer' : 'default' }}>
                <input
                  type="radio"
                  name="overlap_mode"
                  value="highest"
                  checked={settings.surcharge_overlap_mode === 'highest'}
                  onChange={handleSettingsChange('surcharge_overlap_mode')}
                  disabled={!isSuperAdmin}
                />
                Use the largest surcharge only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: isSuperAdmin ? 'pointer' : 'default' }}>
                <input
                  type="radio"
                  name="overlap_mode"
                  value="stack"
                  checked={settings.surcharge_overlap_mode === 'stack'}
                  onChange={handleSettingsChange('surcharge_overlap_mode')}
                  disabled={!isSuperAdmin}
                />
                Add them together
              </label>
            </div>
          </div>

          {isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={settingsSaving}>
                {settingsSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ══════════════════ Card 2: Delivery Zones ══════════════════ */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Delivery Zones</h3>
          {isSuperAdmin && !zoneForm && (
            <button className="btn btn-secondary btn-sm" onClick={openNewZoneForm}>+ Add Zone</button>
          )}
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 16px' }}>
          Each zone has a base delivery fee. Orders below a zone's minimum amount are blocked.
        </p>

        {zoneForm && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', background: '#f8fafc' }}>
            {zoneError && (
              <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{zoneError}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Zone Name</label>
                <input
                  className="form-input"
                  value={zoneForm.name}
                  onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Zone 1 — Central"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fee (GH₵)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={zoneForm.fee}
                  onChange={e => setZoneForm(f => ({ ...f, fee: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Min Order (GH₵)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={zoneForm.min_order_amount}
                  onChange={e => setZoneForm(f => ({ ...f, min_order_amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setZoneForm(null)} disabled={zoneSaving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleZoneSave} disabled={zoneSaving}>
                {zoneSaving ? 'Saving…' : 'Save Zone'}
              </button>
            </div>
          </div>
        )}

        {zones.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📍</div>
            <h3>No delivery zones yet</h3>
            <p>Add a zone to start charging zone-based delivery fees.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Fee</th>
                  <th>Min Order</th>
                  <th>Status</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {zones.map(zone => (
                  <tr key={zone.id}>
                    <td style={{ fontWeight: '600' }}>{zone.name}</td>
                    <td>GH₵{parseFloat(zone.fee).toFixed(2)}</td>
                    <td>{zone.min_order_amount > 0 ? `GH₵${parseFloat(zone.min_order_amount).toFixed(2)}` : '—'}</td>
                    <td>
                      <span className={`badge ${zone.is_active ? 'badge-green' : 'badge-red'}`}>
                        {zone.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditZoneForm(zone)} style={{ marginRight: '6px' }}>
                          Edit
                        </button>
                        {zone.is_active && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleZoneDelete(zone)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════ Card 3: Surcharge Rules ══════════════════ */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Surcharge Rules</h3>
          {isSuperAdmin && !surchargeForm && (
            <button className="btn btn-secondary btn-sm" onClick={openNewSurchargeForm}>+ Add Rule</button>
          )}
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 16px' }}>
          Extra delivery charges for specific days/times (e.g. late-night delivery). Leave day blank to apply every day.
        </p>

        {surchargeForm && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', background: '#f8fafc' }}>
            {surchargeError && (
              <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{surchargeError}</div>
            )}
            <div className="form-group" style={{ margin: '0 0 12px' }}>
              <label className="form-label">Label</label>
              <input
                className="form-input"
                value={surchargeForm.label}
                onChange={e => setSurchargeForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Friday night surcharge"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Day</label>
                <select
                  className="form-input"
                  value={surchargeForm.day_of_week}
                  onChange={e => setSurchargeForm(f => ({ ...f, day_of_week: e.target.value }))}
                >
                  <option value="">Every day</option>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Start Time</label>
                <input
                  className="form-input"
                  type="time"
                  value={surchargeForm.start_time}
                  onChange={e => setSurchargeForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">End Time</label>
                <input
                  className="form-input"
                  type="time"
                  value={surchargeForm.end_time}
                  onChange={e => setSurchargeForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Value</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={surchargeForm.surcharge_value}
                  onChange={e => setSurchargeForm(f => ({ ...f, surcharge_value: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={surchargeForm.surcharge_type}
                  onChange={e => setSurchargeForm(f => ({ ...f, surcharge_type: e.target.value }))}
                >
                  <option value="fixed">GH₵</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 12px' }}>
              Tip: if end time is earlier than start time, the window crosses midnight (e.g. 20:00 → 02:00 means 8pm tonight through 2am).
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSurchargeForm(null)} disabled={surchargeSaving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSurchargeSave} disabled={surchargeSaving}>
                {surchargeSaving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          </div>
        )}

        {surchargeRules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌙</div>
            <h3>No surcharge rules yet</h3>
            <p>Add a rule to charge extra for specific days or time windows.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Day</th>
                  <th>Window</th>
                  <th>Surcharge</th>
                  <th>Status</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {surchargeRules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: '600' }}>{rule.label}</td>
                    <td>{rule.day_of_week === null ? 'Every day' : DAY_NAMES[rule.day_of_week]}</td>
                    <td>{rule.start_time?.slice(0, 5)} – {rule.end_time?.slice(0, 5)}</td>
                    <td>{rule.surcharge_type === 'percent' ? `${rule.surcharge_value}%` : `GH₵${parseFloat(rule.surcharge_value).toFixed(2)}`}</td>
                    <td>
                      <span className={`badge ${rule.is_active ? 'badge-green' : 'badge-red'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditSurchargeForm(rule)} style={{ marginRight: '6px' }}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleSurchargeDelete(rule)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════ Card 4: Automatic Discount Rules ══════════════════ */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Automatic Discount Rules</h3>
          {isSuperAdmin && !discountForm && (
            <button className="btn btn-secondary btn-sm" onClick={openNewDiscountForm}>+ Add Rule</button>
          )}
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 16px' }}>
          Automatically applies the best matching discount when no manual discount is entered on an order.
        </p>

        {discountForm && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', background: '#f8fafc' }}>
            {discountError && (
              <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{discountError}</div>
            )}
            <div className="form-group" style={{ margin: '0 0 12px' }}>
              <label className="form-label">Label</label>
              <input
                className="form-input"
                value={discountForm.label}
                onChange={e => setDiscountForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. 5% off orders over GH₵300"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Value</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={discountForm.discount_value}
                  onChange={e => setDiscountForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={discountForm.discount_type}
                  onChange={e => setDiscountForm(f => ({ ...f, discount_type: e.target.value }))}
                >
                  <option value="percent">%</option>
                  <option value="fixed">GH₵</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Min Order (GH₵)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={discountForm.min_order_amount}
                  onChange={e => setDiscountForm(f => ({ ...f, min_order_amount: e.target.value }))}
                  placeholder="e.g. 300"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setDiscountForm(null)} disabled={discountSaving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDiscountSave} disabled={discountSaving}>
                {discountSaving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          </div>
        )}

        {discountRules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <h3>No automatic discount rules yet</h3>
            <p>Add a rule to automatically discount qualifying orders.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Status</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {discountRules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: '600' }}>{rule.label}</td>
                    <td>{rule.discount_type === 'percent' ? `${rule.discount_value}%` : `GH₵${parseFloat(rule.discount_value).toFixed(2)}`}</td>
                    <td>{rule.min_order_amount > 0 ? `GH₵${parseFloat(rule.min_order_amount).toFixed(2)}` : '—'}</td>
                    <td>
                      <span className={`badge ${rule.is_active ? 'badge-green' : 'badge-red'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditDiscountForm(rule)} style={{ marginRight: '6px' }}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDiscountDelete(rule)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default DeliveryPricingTab;
