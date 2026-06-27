import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useFormValidation, FormError, inputStyle, rules } from '../utils/useFormValidation';

const ROLE_COLORS = {
  super_admin: '#dc2626', admin: '#d97706', manager: '#1d4ed8',
  cashier: '#16a34a', dispatcher: '#7c3aed', warehouse: '#0f766e', rider: '#475569',
};

const Profile = () => {
  const { user: authUser, setUser } = useAuth();
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [toast,     setToast]     = useState(null);
  const photoInputRef = useRef();

  /* ── Form state ──────────────────────────────────────────────── */
  const [form, setForm] = useState({
    name: '', phone: '', date_of_birth: '', gender: '',
    address: '', ghana_card_number: '',
    emergency_name: '', emergency_phone: '', emergency_relation: '',
    passport_photo: '',
  });

  /* ── Password form ───────────────────────────────────────────── */
  const [pwForm,   setPwForm]   = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);

  /* ── Validation ──────────────────────────────────────────────── */
  const profileSchema = {
    name:           [rules.required('Full name')],
    phone:          [rules.phone()],
    emergency_phone:[rules.phone('Emergency phone')],
    ghana_card_number: [rules.ghanaCard()],
  };
  const { errors: fe, validateAll: va, clearError: ce, clearAll: ca } = useFormValidation(profileSchema);

  /* ── Fetch profile ───────────────────────────────────────────── */
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getProfile();
      const u   = res.data.user;
      setProfile(u);
      setForm({
        name:               u.name               || '',
        phone:              u.phone              || '',
        date_of_birth:      u.date_of_birth      ? u.date_of_birth.split('T')[0] : '',
        gender:             u.gender             || '',
        address:            u.address            || '',
        ghana_card_number:  u.ghana_card_number  || '',
        emergency_name:     u.emergency_name     || '',
        emergency_phone:    u.emergency_phone    || '',
        emergency_relation: u.emergency_relation || '',
        passport_photo:     u.passport_photo     || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  /* ── Show toast ──────────────────────────────────────────────── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Photo upload ────────────────────────────────────────────── */
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, passport_photo: reader.result }));
    reader.readAsDataURL(file);
  };

  /* ── Save profile ────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!va(form)) return;
    try {
      setSaving(true);
      const res = await usersAPI.updateProfile(form);
      setProfile(res.data.user);
      if (setUser) setUser(prev => ({ ...prev, name: res.data.user.name }));
      ca();
      showToast('Profile updated successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Change password ─────────────────────────────────────────── */
  const handleChangePassword = async () => {
    if (!pwForm.current_password) return showToast('Enter your current password', 'error');
    if (!pwForm.new_password)     return showToast('Enter a new password', 'error');
    if (pwForm.new_password.length < 8) return showToast('New password must be at least 8 characters', 'error');
    if (!/\d/.test(pwForm.new_password)) return showToast('New password must contain at least one number', 'error');
    if (pwForm.new_password !== pwForm.confirm_password) return showToast('Passwords do not match', 'error');
    try {
      setPwSaving(true);
      await usersAPI.changePassword({
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password changed successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Error changing password', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const tabs = [
    { key: 'profile',  label: '👤 My Profile' },
    { key: 'personal', label: '📋 Personal' },
    { key: 'emergency',label: '🚨 Emergency' },
    { key: 'password', label: '🔐 Password' },
  ];

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading profile…</span>
    </div>
  );

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div
          className={`alert ${toast.type === 'error' ? 'alert-danger' : 'alert-success'}`}
          style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, minWidth: '280px', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}
        >
          {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account details and security</p>
        </div>
      </div>

      {/* Profile hero card */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {form.passport_photo ? (
            <img
              src={form.passport_photo}
              alt="Profile"
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }}
            />
          ) : (
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: ROLE_COLORS[profile?.role] || '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: '800', fontSize: '26px',
            }}>
              {initials}
            </div>
          )}
          <button
            onClick={() => photoInputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'var(--navy)', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '12px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            title="Change photo"
          >📸</button>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontWeight: '800', fontSize: '20px', margin: '0 0 4px' }}>{profile?.name}</h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', margin: '0 0 8px' }}>{profile?.email}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                background: ROLE_COLORS[profile?.role] || '#64748b',
                color: '#fff', textTransform: 'capitalize',
              }}
            >
              {profile?.role?.replace('_', ' ')}
            </span>
            <span className={`badge ${profile?.is_active ? 'badge-green' : 'badge-red'}`}>
              {profile?.is_active ? 'Active' : 'Inactive'}
            </span>
            {profile?.last_login && (
              <span className="badge badge-gray" style={{ fontSize: '11px' }}>
                Last login {new Date(profile.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Member since */}
        {profile?.start_date && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '0 0 2px' }}>Member since</p>
            <p style={{ fontWeight: '600', fontSize: '13px', margin: 0 }}>
              {new Date(profile.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Profile ─────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={form.name}
              style={inputStyle(fe.name)}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); ce('name'); }}
              placeholder="Your full name"
            />
            <FormError error={fe.name} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              value={profile?.email || ''}
              disabled
              style={{ background: '#f8fafc', color: 'var(--text-3)', cursor: 'not-allowed' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>
              Email cannot be changed — contact your admin
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              value={form.phone}
              style={inputStyle(fe.phone)}
              onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); ce('phone'); }}
              placeholder="e.g. 0244123456"
            />
            <FormError error={fe.phone} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <input
              className="form-input"
              value={profile?.role?.replace('_', ' ') || ''}
              disabled
              style={{ background: '#f8fafc', color: 'var(--text-3)', cursor: 'not-allowed', textTransform: 'capitalize' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>
              Role is assigned by your admin
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── Tab: Personal ────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input className="form-input" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Home Address</label>
            <textarea className="form-input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Madina, Accra" />
          </div>
          <div className="form-group">
            <label className="form-label">Ghana Card Number</label>
            <input
              className="form-input"
              value={form.ghana_card_number}
              style={{ fontFamily: 'monospace', ...inputStyle(fe.ghana_card_number) }}
              onChange={e => { setForm(f => ({ ...f, ghana_card_number: e.target.value })); ce('ghana_card_number'); }}
              placeholder="GHA-000000000-0"
            />
            <FormError error={fe.ghana_card_number} />
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── Tab: Emergency ───────────────────────────────────────── */}
      {activeTab === 'emergency' && (
        <div className="card">
          <div className="alert alert-info" style={{ marginBottom: '16px' }}>
            This contact will be reached in case of an emergency involving you.
          </div>
          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input className="form-input" value={form.emergency_name} onChange={e => setForm(f => ({ ...f, emergency_name: e.target.value }))} placeholder="e.g. Kofi Mensah" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                className="form-input"
                value={form.emergency_phone}
                style={inputStyle(fe.emergency_phone)}
                onChange={e => { setForm(f => ({ ...f, emergency_phone: e.target.value })); ce('emergency_phone'); }}
                placeholder="e.g. 0201234567"
              />
              <FormError error={fe.emergency_phone} />
            </div>
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select className="form-input" value={form.emergency_relation} onChange={e => setForm(f => ({ ...f, emergency_relation: e.target.value }))}>
                <option value="">Select…</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Child">Child</option>
                <option value="Friend">Friend</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── Tab: Password ─────────────────────────────────────────── */}
      {activeTab === 'password' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Current Password *</label>
            <input
              className="form-input"
              type="password"
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
              placeholder="Your current password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input
              className="form-input"
              type="password"
              value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
              placeholder="Min 8 characters, at least 1 number"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input
              className="form-input"
              type="password"
              value={pwForm.confirm_password}
              onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
              placeholder="Repeat new password"
              style={pwForm.confirm_password && pwForm.confirm_password !== pwForm.new_password ? inputStyle('error') : {}}
            />
            {pwForm.confirm_password && pwForm.confirm_password !== pwForm.new_password && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>⚠ Passwords do not match</p>
            )}
          </div>
          <div className="alert alert-info" style={{ marginBottom: '16px', fontSize: '12px' }}>
            Password must be at least 8 characters and contain at least one number. You will remain logged in after changing your password.
          </div>
          <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwSaving}>
            {pwSaving ? 'Changing…' : '🔐 Change Password'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
