import React, { useState, useEffect } from 'react';
import { usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const label = { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'block' };
const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const errText = { color: '#ef4444', fontSize: 12, marginTop: 4 };

const roleColor = (role) => ({
  super_admin: '#dc2626', admin: '#d97706', manager: '#1d4ed8',
  customer_support: '#7c3aed', cashier: '#16a34a', dispatcher: '#8b5cf6',
  warehouse: '#f59e0b', auditor: '#64748b', rider: '#475569', accountant: '#0f766e',
}[role] || '#6b7280');

const TransportProfile = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);

  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await usersAPI.getProfile();
      setProfile(res.data.user);
      setForm({
        name: res.data.user.name || '',
        phone: res.data.user.phone || '',
        address: res.data.user.address || '',
        emergency_name: res.data.user.emergency_name || '',
        emergency_phone: res.data.user.emergency_phone || '',
        emergency_relation: res.data.user.emergency_relation || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      const res = await usersAPI.updateProfile(form);
      setProfile(res.data.user);
      setEditing(false);
      showToast('Profile updated');
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const errs = {};
    if (!pwdForm.current_password) errs.current_password = 'Enter your current password';
    if (!pwdForm.new_password || pwdForm.new_password.length < 8) errs.new_password = 'New password must be at least 8 characters';
    else if (!/\d/.test(pwdForm.new_password)) errs.new_password = 'New password must contain at least one number';
    if (pwdForm.new_password !== pwdForm.confirm_password) errs.confirm_password = 'Passwords do not match';
    setPwdErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwdSaving(true);
    try {
      await usersAPI.changePassword({ current_password: pwdForm.current_password, new_password: pwdForm.new_password });
      setShowPwd(false);
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password changed');
    } catch (err) {
      setPwdErrors({ current_password: err.response?.data?.message || 'Could not change password' });
    } finally {
      setPwdSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading…</div>
  );

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ paddingBottom: 24 }}>
      {toast && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          ✓ {toast}
        </div>
      )}

      {/* Header card */}
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: roleColor(profile?.role), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
          margin: '0 auto 12px',
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a18' }}>{profile?.name}</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{profile?.email}</div>
        <span style={{
          display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, color: roleColor(profile?.role),
          background: roleColor(profile?.role) + '15', padding: '3px 10px', borderRadius: 8, textTransform: 'capitalize',
        }}>
          {profile?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Personal info */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>Personal Info</span>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✎ Edit
            </button>
          )}
        </div>

        {editing ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <span style={label}>Full Name</span>
              <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <span style={label}>Phone</span>
              <input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <span style={label}>Address</span>
              <input style={input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <span style={label}>Emergency Contact Name</span>
              <input style={input} value={form.emergency_name} onChange={e => setForm({ ...form, emergency_name: e.target.value })} />
            </div>
            <div>
              <span style={label}>Emergency Contact Phone</span>
              <input style={input} value={form.emergency_phone} onChange={e => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
            <div>
              <span style={label}>Relationship</span>
              <input style={input} value={form.emergency_relation} onChange={e => setForm({ ...form, emergency_relation: e.target.value })} placeholder="e.g. Spouse, Parent, Sibling" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setEditing(false); fetchProfile(); }} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <InfoRow label="Phone" value={profile?.phone} />
            <InfoRow label="Address" value={profile?.address} />
            <InfoRow label="Emergency Contact" value={profile?.emergency_name ? `${profile.emergency_name} (${profile.emergency_relation || '—'})` : null} />
            <InfoRow label="Emergency Phone" value={profile?.emergency_phone} />
          </div>
        )}
      </div>

      {/* Account info (read-only) */}
      <div style={card}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', marginBottom: 14, display: 'block' }}>Account</span>
        <div style={{ display: 'grid', gap: 10 }}>
          <InfoRow label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
          <InfoRow label="Last Login" value={profile?.last_login ? new Date(profile.last_login).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'This session'} />
        </div>
      </div>

      {/* Change password */}
      <div style={card}>
        {!showPwd ? (
          <button onClick={() => setShowPwd(true)} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#1a1a18', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🔒 Change Password
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>Change Password</span>
            <div>
              <input style={input} type="password" placeholder="Current password" value={pwdForm.current_password}
                onChange={e => { setPwdForm({ ...pwdForm, current_password: e.target.value }); setPwdErrors({ ...pwdErrors, current_password: null }); }} />
              {pwdErrors.current_password && <div style={errText}>{pwdErrors.current_password}</div>}
            </div>
            <div>
              <input style={input} type="password" placeholder="New password (min 8 chars, 1 number)" value={pwdForm.new_password}
                onChange={e => { setPwdForm({ ...pwdForm, new_password: e.target.value }); setPwdErrors({ ...pwdErrors, new_password: null }); }} />
              {pwdErrors.new_password && <div style={errText}>{pwdErrors.new_password}</div>}
            </div>
            <div>
              <input style={input} type="password" placeholder="Confirm new password" value={pwdForm.confirm_password}
                onChange={e => { setPwdForm({ ...pwdForm, confirm_password: e.target.value }); setPwdErrors({ ...pwdErrors, confirm_password: null }); }} />
              {pwdErrors.confirm_password && <div style={errText}>{pwdErrors.confirm_password}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowPwd(false); setPwdForm({ current_password: '', new_password: '', confirm_password: '' }); setPwdErrors({}); }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleChangePassword} disabled={pwdSaving}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#1a1a18', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: pwdSaving ? 0.6 : 1 }}>
                {pwdSaving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={logout} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        Log Out
      </button>
    </div>
  );
};

const InfoRow = ({ label: l, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
    <span style={{ fontSize: 12, color: '#9ca3af' }}>{l}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: value ? '#1a1a18' : '#d1d5db' }}>{value || 'Not set'}</span>
  </div>
);

export default TransportProfile;
