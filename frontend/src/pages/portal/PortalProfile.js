import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   RIDER PROFILE — unchanged from the original PortalProfile.js
═══════════════════════════════════════════════════════════════ */
function RiderProfile({ user }) {
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRider = useCallback(async () => {
    try {
      const res = await ridersAPI.getAll({ limit: 200 });
      const myRider = (res.data.riders || []).find(r => String(r.user_id) === String(user?.id));
      setRider(myRider || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRider(); }, [fetchRider]);

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading…</span></div>;

  if (!rider) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
      <p style={{ color: '#6b7280' }}>No rider profile linked to your account.</p>
    </div>
  );

  const expiryAlert = (date, label) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days > 30) return null;
    return (
      <div style={{ background: days <= 0 ? '#fee2e2' : '#fef3c7', border: `1px solid ${days <= 0 ? '#fca5a5' : '#fde68a'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: days <= 0 ? '#dc2626' : '#d97706', fontWeight: 600, marginTop: 6 }}>
        {days <= 0 ? `⚠️ ${label} EXPIRED` : `⚠️ ${label} expires in ${days} day${days !== 1 ? 's' : ''}`}
      </div>
    );
  };

  const fields = [
    { label: 'Full Name', value: rider.name },
    { label: 'Phone', value: rider.phone },
    { label: 'Zone', value: rider.zone || '—' },
    { label: 'Vehicle Type', value: rider.vehicle_type || '—' },
    { label: 'Vehicle', value: rider.vehicle_make_model ? `${rider.vehicle_make_model} ${rider.vehicle_color ? `(${rider.vehicle_color})` : ''}` : '—' },
    { label: 'Plate Number', value: rider.vehicle_number || '—' },
    { label: 'MoMo Number', value: rider.momo_number || '—' },
    { label: 'Ghana Card', value: rider.ghana_card_number || '—' },
    { label: 'License Number', value: rider.license_number || '—' },
    { label: 'Insurance', value: rider.insurance_number || '—' },
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {rider.passport_photo ? (
          <img src={rider.passport_photo} alt={rider.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #22c55e' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 28, margin: '0 auto' }}>
            {rider.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 700 }}>{rider.name}</h2>
        <span style={{ background: rider.is_active ? '#dcfce7' : '#fee2e2', color: rider.is_active ? '#16a34a' : '#dc2626', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
          {rider.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {expiryAlert(rider.license_expiry, 'Driver License')}
      {expiryAlert(rider.insurance_expiry, 'Vehicle Insurance')}

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 16 }}>
        {fields.map((f, i) => (
          <div key={f.label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '14px 16px',
            borderBottom: i < fields.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{f.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', textAlign: 'right', maxWidth: '60%' }}>{f.value}</span>
          </div>
        ))}
      </div>

      {rider.emergency_name && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>🚨 Emergency Contact</p>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>{rider.emergency_name}</p>
          <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>{rider.emergency_phone}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{rider.emergency_relation}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAFF PROFILE — super_admin / admin / manager / cashier /
   dispatcher / warehouse. Uses usersAPI.getProfile(), confirmed
   against the real userController.js — returns name, email, role,
   phone, plus emergency contact / address fields shared with the
   rider profile shape, since users and riders both store these.
═══════════════════════════════════════════════════════════════ */
function StaffProfile({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await usersAPI.getProfile();
      const fetched = res.data.user || null;
      /* Always display the role passed in (reflects view_as during
         a super_admin preview) rather than the real account's own
         role — name/email/phone/etc still come from the real fetch
         since there's no separate session for the previewed role. */
      setProfile(fetched ? { ...fetched, role: user?.role } : null);
    } catch (e) {
      console.error(e);
      setProfile(user || null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading…</span></div>;

  const p = profile || {};
  const fields = [
    { label: 'Full Name', value: p.name || '—' },
    { label: 'Email', value: p.email || '—' },
    { label: 'Phone', value: p.phone || '—' },
    { label: 'Role', value: p.role ? p.role.replace('_', ' ') : '—', capitalize: true },
    { label: 'Address', value: p.address || '—' },
    { label: 'Ghana Card', value: p.ghana_card_number || '—' },
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 800, fontSize: 28, margin: '0 auto' }}>
          {p.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 700 }}>{p.name || 'Unknown'}</h2>
        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
          {p.role ? p.role.replace('_', ' ') : 'Staff'}
        </span>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <div key={f.label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '14px 16px',
            borderBottom: i < fields.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{f.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', textAlign: 'right', maxWidth: '60%', textTransform: f.capitalize ? 'capitalize' : 'none' }}>
              {f.value}
            </span>
          </div>
        ))}
      </div>

      {p.emergency_name && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>🚨 Emergency Contact</p>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>{p.emergency_name}</p>
          <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>{p.emergency_phone}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{p.emergency_relation}</p>
        </div>
      )}

      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
        To change your password, use the full dashboard on a desktop browser.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT — branches by role, with super_admin-only ?view_as=
   preview support.
═══════════════════════════════════════════════════════════════ */
export default function PortalProfile() {
  const { user } = useAuth();
  const location = useLocation();

  const viewAsParam = new URLSearchParams(location.search).get('view_as');
  const isPreviewing = user?.role === 'super_admin' && !!viewAsParam;
  const effectiveUser = isPreviewing ? { ...user, role: viewAsParam } : user;
  const role = effectiveUser?.role;

  if (role === 'rider') {
    return <RiderProfile user={effectiveUser} />;
  }
  return <StaffProfile user={effectiveUser} />;
}
