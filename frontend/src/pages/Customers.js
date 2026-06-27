import React, { useState, useEffect, useCallback } from 'react';
import { customersAPI, ordersAPI } from '../utils/api';
import { useFormValidation, FormError, inputStyle, rules } from '../utils/useFormValidation';
import { useAuth } from '../context/AuthContext';

const avatarColor = (name) => {
  const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#14b8a6','#ef4444','#22c55e'];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

const StatusBadge = ({ status }) => {
  const cls =
    status === 'delivered'        ? 'badge badge-green' :
    status === 'failed'           ? 'badge badge-red'   :
    status === 'out_for_delivery' ? 'badge badge-amber' :
    status === 'pending'          ? 'badge badge-amber' : 'badge badge-gray';
  return <span className={cls}>{status?.replace(/_/g, ' ')}</span>;
};

const ValueBadge = ({ spend }) => {
  const s = parseFloat(spend || 0);
  if (s >= 1000) return <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>⭐ VIP</span>;
  if (s >= 200)  return <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>Regular</span>;
  return <span className="badge badge-gray">New</span>;
};

const Customers = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const customerSchema = {
    name:  [rules.required('Full name')],
    phone: [rules.required('Phone'), rules.phone()],
    email: [rules.email()],
  };
  const { errors: fe, validateAll: va, clearError: ce, clearAll: ca } = useFormValidation(customerSchema);

  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ name: '', phone: '', email: '', address: '' });

  // CRM Profile Panel
  const [showProfile,    setShowProfile]    = useState(false);
  const [profileData,    setProfileData]    = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [notes,          setNotes]          = useState('');
  const [savingNotes,    setSavingNotes]    = useState(false);
  const [activeTab,      setActiveTab]      = useState('orders');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const res = await customersAPI.getAll(params);
      setCustomers(res.data.customers || []);
      setTotal(res.data.total  || 0);
      setPages(res.data.pages  || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(1); }, [search]);

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
    } catch (e) { console.error(e); }
    setLoadingProfile(false);
  };

  const handleSaveNotes = async () => {
    if (!profileData) return;
    setSavingNotes(true);
    try {
      await customersAPI.updateNotes(profileData.customer.id, { notes });
    } catch (e) { console.error(e); }
    setSavingNotes(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    ca();
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({ name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!va(form)) return;
    try {
      setSaving(true);
      editing ? await customersAPI.update(editing.id, form) : await customersAPI.create(form);
      setShowModal(false);
      fetchCustomers();
    } catch (err) { alert(err.response?.data?.message || 'Error saving customer'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    try {
      await customersAPI.delete(customer.id);
      fetchCustomers();
    } catch { alert('Error deleting customer'); }
  };

  const sendWhatsApp = (phone) => {
    const p = phone?.replace(/\D/g, '');
    const intl = p?.startsWith('0') ? '233' + p.slice(1) : p;
    window.open(`https://wa.me/${intl}`, '_blank');
  };

  const stats = profileData?.stats;
  const successRate = stats ? Math.round((stats.delivered / Math.max(stats.total_orders, 1)) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{total} customers total</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="search-bar">
          <input className="form-input" placeholder="🔍 Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          {search && <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear</button>}
          <span className="pagination-info">{total} result{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading customers…</span></div>
        ) : customers.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-icon">👤</div>
            <h3>No customers yet</h3>
            <p>{search ? 'No customers match your search.' : 'Add your first customer to get started.'}</p>
            {!search && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Add Customer</button>}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                            {customer.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{customer.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>{customer.phone}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{customer.email || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => openProfile(customer)}>👤 Profile</button>
                          <button className="btn btn-success btn-sm" onClick={() => sendWhatsApp(customer.phone)} style={{ padding: '6px 10px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(customer)}>Edit</button>
                          {isSuperAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(customer)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">Page {page} of {pages} · {total} customers</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CRM Profile Panel ─────────────────────────────────────── */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          {/* Backdrop */}
          <div onClick={() => setShowProfile(false)} style={{ flex: 1, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)' }} />
          {/* Panel */}
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            {loadingProfile ? (
              <div className="loading" style={{ flex: 1 }}><div className="loading-spinner" /><span className="loading-text">Loading profile…</span></div>
            ) : profileData ? (
              <>
                {/* Header */}
                <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9f9f8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(profileData.customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20 }}>
                        {profileData.customer.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{profileData.customer.name}</h2>
                        <p style={{ margin: '2px 0 6px', color: '#6b7280', fontSize: 13 }}>{profileData.customer.phone} {profileData.customer.email ? `· ${profileData.customer.email}` : ''}</p>
                        <ValueBadge spend={stats?.total_spend} />
                      </div>
                    </div>
                    <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                  </div>
                  {/* Quick actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success btn-sm" onClick={() => sendWhatsApp(profileData.customer.phone)}>💬 WhatsApp</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setShowProfile(false); openEdit(profileData.customer); }}>✏️ Edit</button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
                  {[
                    { label: 'Total Orders', value: stats?.total_orders || 0, color: '#1a1a18' },
                    { label: 'Total Spend', value: fmt(stats?.total_spend), color: '#22c55e' },
                    { label: 'Avg Order Value', value: fmt(stats?.avg_order_value), color: '#3b82f6' },
                    { label: 'Success Rate', value: `${successRate}%`, color: successRate >= 80 ? '#22c55e' : successRate >= 50 ? '#f59e0b' : '#ef4444' },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ margin: 0 }}>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value" style={{ fontSize: 18, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="tabs" style={{ padding: '0 24px', borderBottom: '1px solid #f3f4f6' }}>
                  <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Orders ({stats?.total_orders || 0})</button>
                  <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>
                  <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Info</button>
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, padding: 24 }}>
                  {activeTab === 'orders' && (
                    profileData.orders.length === 0 ? (
                      <div className="empty-state" style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 32 }}>📦</div>
                        <p>No orders yet</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {profileData.orders.map(order => (
                          <div key={order.id} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{order.order_number}</div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{order.rider_name ? ` · ${order.rider_name}` : ''}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>{fmt(order.total_amount)}</div>
                              <div style={{ marginTop: 4 }}><StatusBadge status={order.status} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {activeTab === 'notes' && (
                    <div>
                      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Internal notes about this customer — not visible to them.</p>
                      <textarea
                        className="form-input"
                        rows={8}
                        placeholder="e.g. Prefers morning deliveries, always pays cash…"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                      <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleSaveNotes} disabled={savingNotes}>
                        {savingNotes ? 'Saving…' : 'Save Notes'}
                      </button>
                    </div>
                  )}

                  {activeTab === 'info' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        { label: 'Full Name', value: profileData.customer.name },
                        { label: 'Phone', value: profileData.customer.phone },
                        { label: 'Email', value: profileData.customer.email || '—' },
                        { label: 'Address', value: profileData.customer.address || '—' },
                        { label: 'Customer Since', value: new Date(profileData.customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
                        { label: 'Last Order', value: stats?.last_order_date ? new Date(stats.last_order_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                        { label: 'Failed Orders', value: stats?.failed || 0 },
                        { label: 'Pending Orders', value: stats?.pending || 0 },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', maxWidth: 260, textAlign: 'right' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p>Failed to load profile</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} style={inputStyle(fe.name)} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); ce('name'); }} placeholder="e.g. Kofi Mensah" />
              <FormError error={fe.name} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-input" value={form.phone} style={inputStyle(fe.phone)} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); ce('phone'); }} placeholder="e.g. 0244123456" />
              <FormError error={fe.phone} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} style={inputStyle(fe.email)} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); ce('email'); }} placeholder="optional" />
              <FormError error={fe.email} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <textarea className="form-input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Accra, East Legon" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Customer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
