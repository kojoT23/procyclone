import React, { useState, useEffect, useCallback } from 'react';
import { businessProfileAPI } from '../utils/api';

const BusinessProfileTab = ({ currentUser }) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [errors,  setErrors]    = useState({});
  const [saved,   setSaved]     = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    address:       '',
    phone:         '',
    momo_number:   '',
  });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await businessProfileAPI.get();
      const p = res.data.profile;
      setForm({
        business_name: p.business_name || '',
        address:       p.address || '',
        phone:         p.phone || '',
        momo_number:   p.momo_number || '',
      });
    } catch (err) {
      console.error('Failed to load business profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleChange = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
    if (errors[field]) setErrors(e2 => ({ ...e2, [field]: null }));
  };

  // Real Ghana mobile network prefixes (MTN, Vodafone, AirtelTigo, Glo).
  // A number must start with one of these — pure digit-counting isn't
  // enough, since e.g. "0901234567" is 10 digits but not a real prefix.
  const GHANA_PREFIXES = [
    '020', '050',                   // Vodafone
    '024', '054', '055', '059',     // MTN
    '026', '056', '027', '057',     // AirtelTigo
    '023', '053',                   // Glo / others
  ];

  const isValidGhanaPhone = (value) => {
    const cleaned = value.replace(/[\s-]/g, '');

    // +233XXXXXXXXX -> normalize to 0XXXXXXXXX for prefix checking
    let local = cleaned;
    if (cleaned.startsWith('+233')) {
      local = '0' + cleaned.slice(4);
    }

    if (!/^\d{10}$/.test(local)) return false; // must be exactly 10 digits locally
    return GHANA_PREFIXES.some(prefix => local.startsWith(prefix));
  };

  const validateForm = (data) => {
    const next = {};
    if (!data.business_name || !data.business_name.trim()) {
      next.business_name = 'Business name is required';
    } else if (data.business_name.length > 150) {
      next.business_name = 'Business name is too long (max 150 characters)';
    }

    if (!data.address || !data.address.trim()) {
      next.address = 'Address is required';
    } else if (data.address.length > 255) {
      next.address = 'Address is too long (max 255 characters)';
    }

    if (!data.phone || !data.phone.trim()) {
      next.phone = 'Phone number is required';
    } else if (data.phone.length > 30) {
      next.phone = 'Phone number is too long (max 30 characters)';
    } else if (!isValidGhanaPhone(data.phone)) {
      next.phone = 'Numbers only (+ allowed) — e.g. 024 123 4567 or +233 24 123 4567';
    }

    if (!data.momo_number || !data.momo_number.trim()) {
      next.momo_number = 'MoMo number is required';
    } else if (data.momo_number.length > 30) {
      next.momo_number = 'MoMo number is too long (max 30 characters)';
    } else if (!isValidGhanaPhone(data.momo_number)) {
      next.momo_number = 'Numbers only (+ allowed) — e.g. 055 987 6543 or +233 55 987 6543';
    }

    return next;
  };

  const doSave = async (data) => {
    if (!isSuperAdmin) return;

    const validationErrors = validateForm(data);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSaved(false);
      return;
    }

    setSaving(true);
    setErrors({});
    setSaved(false);

    try {
      await businessProfileAPI.update(data);
      setSaved(true);
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors)) {
        const fieldErrors = {};
        apiErrors.forEach(er => { fieldErrors[er.path || er.param] = er.msg; });
        setErrors(fieldErrors);
      } else {
        alert(err.response?.data?.message || 'Error saving business profile');
      }
    } finally {
      setSaving(false);
    }
  };

  // Button click runs validation directly — does not depend on <form onSubmit> propagation at all.
  const handleSaveClick = (e) => {
    e.preventDefault();
    doSave(form);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span className="loading-text">Loading business profile…</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 4px' }}>
        Business Profile
      </h3>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 20px' }}>
        These details appear on every receipt and customer-facing document.
      </p>

      {!isSuperAdmin && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>
          Only a super admin can edit business profile details. You can view them below.
        </div>
      )}

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          ✓ Business profile saved. New receipts will use these details.
        </div>
      )}

      <div>
        <div className="form-group">
          <label className="form-label">Business Name</label>
          <input
            className="form-input"
            value={form.business_name}
            onChange={handleChange('business_name')}
            disabled={!isSuperAdmin}
            placeholder="Shorewinds"
          />
          {errors.business_name && (
            <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
              {errors.business_name}
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Address</label>
          <input
            className="form-input"
            value={form.address}
            onChange={handleChange('address')}
            disabled={!isSuperAdmin}
            placeholder="e.g. 12 Liberation Road, Accra"
          />
          {errors.address && (
            <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
              {errors.address}
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={handleChange('phone')}
              disabled={!isSuperAdmin}
              placeholder="e.g. 024 123 4567"
            />
            {errors.phone && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
                {errors.phone}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              MoMo Number
              <span style={{ color: 'var(--text-3)', fontWeight: '400', marginLeft: '4px' }}>
                (shown on cash receipts)
              </span>
            </label>
            <input
              className="form-input"
              value={form.momo_number}
              onChange={handleChange('momo_number')}
              disabled={!isSuperAdmin}
              placeholder="e.g. 055 987 6543"
            />
            {errors.momo_number && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>
                {errors.momo_number}
              </p>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveClick}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessProfileTab;
