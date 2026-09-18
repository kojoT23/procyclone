import React, { useState, useEffect, useCallback } from 'react';
import { customersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const avatarColor = (name) => {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#ef4444', '#22c55e'];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const STATUS_COLORS = {
  delivered: { bg: '#dcfce7', text: '#16a34a' },
  failed: { bg: '#fee2e2', text: '#dc2626' },
  out_for_delivery: { bg: '#fed7aa', text: '#c2410c' },
  pending: { bg: '#fef3c7', text: '#d97706' },
};

const isValidPhone = (phone) => /^(0[2-9]\d{8}|\+233[2-9]\d{8})$/.test((phone || '').replace(/\s|-/g, ''));
const isValidEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function PortalCustomers() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [errors, setErrors] = useState({});

  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 30 };
      if (search) params.search = search;
      const res = await customersAPI.getAll(params);
      setCustomers(res.data.customers || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({ name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '' });
    setErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    else if (!isValidPhone(form.phone)) errs.phone = 'Enter a valid Ghana phone number';
    if (!isValidEmail(form.email)) errs.email = 'Enter a valid email address';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      setSaving(true);
      editing ? await customersAPI.update(editing.id, form) : await customersAPI.create(form);
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    try {
      await customersAPI.delete(customer.id);
      setShowProfile(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting customer');
    }
  };

  const sendWhatsApp = (phone) => {
    const p = phone?.replace(/\D/g, '');
    const intl = p?.startsWith('0') ? '233' + p.slice(1) : p;
    window.open(`https://wa.me/${intl}`, '_blank');
  };

  const openProfile = async (customer) => {
    setShowProfile(true);
    setProfileData(null);
    setActiveTab('orders');
    setLoadingProfile(true);
    try {
      const res = await customersAPI.getProfile(customer.id);
      if (res.data.success) {
        setProfileData(res.data);
        setNotes(res.data.customer.notes || '');
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingProfile(false);
  };

  const handleSaveNotes = async () => {
    if (!profileData) return;
    setSavingNotes(true);
    try {
      await customersAPI.updateNotes(profileData.customer.id, { notes });
    } catch (e) {
      console.error(e);
    }
    setSavingNotes(false);
  };

  const stats = profileData?.stats;
  const successRate = stats ? Math.round((stats.delivered / Math.max(stats.total_orders, 1)) * 100) : 0;

  if (showProfile) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f9f9f8', zIndex: 300, overflowY: 'auto' }}>
        {loadingProfile ? (
          <div className="loading" style={{ height: '100vh' }}><div className="loading-spinner" /></div>
        ) : profileData ? (
          <>
            <div style={{ background: '#1a1a18', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#fff', cursor: 'pointer' }}>←</button>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Customer Profile</span>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(profileData.customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
                  {profileData.customer.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{profileData.customer.name}</h2>
                  <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: 13 }}>{profileData.customer.phone}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => sendWhatsApp(profileData.customer.phone)} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💬 WhatsApp</button>
                <button onClick={() => { setShowProfile(false); openEdit(profileData.customer); }} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
                {isSuperAdmin && (
                  <button onClick={() => handleDelete(profileData.customer)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total Orders', value: stats?.total_orders || 0, color: '#1a1a18' },
                  { label: 'Total Spend', value: fmt(stats?.total_spend), color: '#22c55e' },
                  { label: 'Avg Order', value: fmt(stats?.avg_order_value), color: '#3b82f6' },
                  { label: 'Success Rate', value: `${successRate}%`, color: successRate >= 80 ? '#22c55e' : successRate >= 50 ? '#f59e0b' : '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#fff', borderRadius: 10, padding: 4 }}>
                {[
                  { key: 'orders', label: `Orders (${stats?.total_orders || 0})` },
                  { key: 'notes', label: 'Notes' },
                  { key: 'info', label: 'Info' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: activeTab === t.key ? '#1a1a18' : 'transparent', color: activeTab === t.key ? '#fff' : '#6b7280',
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === 'orders' && (
                profileData.orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profileData.orders.map(order => {
                      const colors = STATUS_COLORS[order.status] || { bg: '#f1f5f9', text: '#475569' };
                      return (
                        <div key={order.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{order.order_number}</div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                              {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{order.rider_name ? ` · ${order.rider_name}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{fmt(order.total_amount)}</div>
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: colors.bg, color: colors.text, textTransform: 'capitalize' }}>
                              {order.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeTab === 'notes' && (
                <div>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Internal notes — not visible to the customer.</p>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="e.g. Prefers morning deliveries…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <button onClick={handleSaveNotes} disabled={savingNotes} style={{ width: '100%', marginTop: 10, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              )}

              {activeTab === 'info' && (
                <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                  {[
                    { label: 'Phone', value: profileData.customer.phone },
                    { label: 'Email', value: profileData.customer.email || '—' },
                    { label: 'Address', value: profileData.customer.address || '—' },
                    { label: 'Joined', value: new Date(profileData.customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  ].map((f, i, arr) => (
                    <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{f.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Couldn't load this profile.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Customers</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{total} total</p>
        </div>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
      </div>

      <input
        className="form-input"
        placeholder="🔍 Search by name, phone or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 14 }}
      />

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <p style={{ color: '#6b7280' }}>{search ? 'No customers match your search.' : 'Add your first customer to get started.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customers.map(customer => (
            <div key={customer.id} onClick={() => openProfile(customer)} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                {customer.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{customer.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{customer.phone}</div>
              </div>
              <span style={{ fontSize: 16, color: '#9ca3af' }}>›</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>{editing ? 'Edit Customer' : 'Add Customer'}</h3>

            <input className="form-input" placeholder="Full name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', marginBottom: 4 }} />
            {errors.name && <p style={{ fontSize: 11, color: '#dc2626', margin: '0 0 8px' }}>{errors.name}</p>}

            <input className="form-input" placeholder="Phone" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', marginTop: 8, marginBottom: 4 }} />
            {errors.phone && <p style={{ fontSize: 11, color: '#dc2626', margin: '0 0 8px' }}>{errors.phone}</p>}

            <input className="form-input" placeholder="Email (optional)" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} style={{ width: '100%', marginTop: 8, marginBottom: 4 }} />
            {errors.email && <p style={{ fontSize: 11, color: '#dc2626', margin: '0 0 8px' }}>{errors.email}</p>}

            <input className="form-input" placeholder="Address (optional)" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })} style={{ width: '100%', marginTop: 8, marginBottom: 16 }} />

            <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
