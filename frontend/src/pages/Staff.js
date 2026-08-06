import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usersAPI } from '../utils/api';
import { useFormValidation, FormError, inputStyle, rules } from '../utils/useFormValidation';
import { useAuth } from '../context/AuthContext';

/* ─── Constants ───────────────────────────────────────────────── */
const ROLES = ['super_admin','admin','manager','accountant','customer_support','cashier','dispatcher','warehouse','auditor','rider'];

const ROLE_BADGE = {
  super_admin: 'badge badge-red',
  admin:       'badge badge-amber',
  manager:     'badge badge-blue',
  cashier:     'badge badge-green',
  dispatcher:  'badge badge-purple',
  warehouse:   'badge badge-teal',
  rider:       'badge badge-gray',
};

const ROLE_AVATAR = {
  super_admin: '#dc2626', admin: '#d97706', manager: '#1d4ed8',
  cashier: '#16a34a', dispatcher: '#7c3aed', warehouse: '#0f766e', rider: '#475569',
};

const EMPTY_FORM = {
  // Account
  name: '', email: '', password: '', role: 'cashier', phone: '',
  // Personal
  date_of_birth: '', gender: '', address: '',
  ghana_card_number: '', start_date: '',
  // Emergency
  emergency_name: '', emergency_phone: '', emergency_relation: '',
  // Photo + notes
  passport_photo: '', notes: '',
};

/* ─── Staff profile card ──────────────────────────────────────── */
const ProfileCard = ({ user, onEdit, onDelete, onToggle, currentUser }) => {
  const isSelf       = user.id === currentUser?.id;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const initials     = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  // A customer_support account that's inactive is presumed pending
  // approval (that's the only way it gets created inactive) rather than
  // deliberately deactivated — shown distinctly so it doesn't get mistaken
  // for a disabled account when a super_admin is scanning the list.
  const isPendingApproval = !user.is_active && user.role === 'customer_support';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
      {/* Coloured top strip */}
      <div style={{ height: '6px', background: ROLE_AVATAR[user.role] || '#94a3b8' }} />

      <div style={{ padding: '20px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flexShrink: 0 }}>
            {user.passport_photo ? (
              <img
                src={user.passport_photo}
                alt={user.name}
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f1f5f9' }}
              />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: ROLE_AVATAR[user.role] || '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: '800', fontSize: '18px', flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <p style={{ fontWeight: '700', fontSize: '15px', margin: 0 }}>{user.name}</p>
              {isSelf && <span className="badge badge-navy" style={{ fontSize: '10px' }}>You</span>}
            </div>
            <span className={ROLE_BADGE[user.role] || 'badge badge-gray'} style={{ marginTop: '4px', display: 'inline-block' }}>
              {user.role?.replace('_', ' ')}
            </span>
          </div>
          <span className={`badge ${user.is_active ? 'badge-green' : isPendingApproval ? 'badge-amber' : 'badge-red'}`} style={{ flexShrink: 0 }}>
            {user.is_active ? 'Active' : isPendingApproval ? '⏳ Pending Approval' : 'Inactive'}
          </span>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>📧</span>
            <span style={{ wordBreak: 'break-all' }}>{user.email}</span>
          </div>
          {user.phone && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📞</span><span>{user.phone}</span>
            </div>
          )}
          {user.address && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📍</span><span>{user.address}</span>
            </div>
          )}
          {user.ghana_card_number && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🪪</span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                {user.ghana_card_number}
              </span>
            </div>
          )}
          {user.date_of_birth && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🎂</span>
              <span>{new Date(user.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {user.start_date && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📅</span>
              <span>Joined {new Date(user.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
          {user.emergency_name && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🚨</span>
              <span>{user.emergency_name} ({user.emergency_relation}) · {user.emergency_phone}</span>
            </div>
          )}
          {user.last_login && (
            <div style={{ display: 'flex', gap: '8px', color: 'var(--text-3)', fontSize: '12px' }}>
              <span>🕐</span>
              <span>Last login {new Date(user.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(user)}>✏️ Edit</button>
          {!isSelf && isSuperAdmin && (
            <button
              className={`btn btn-sm ${user.is_active ? 'btn-warning' : isPendingApproval ? 'btn-primary' : 'btn-success'}`}
              onClick={() => onToggle(user)}
            >
              {user.is_active ? 'Deactivate' : isPendingApproval ? '✓ Approve' : 'Activate'}
            </button>
          )}
          {!isSelf && isSuperAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(user)}>🗑 Delete</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Staff = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [viewMode,   setViewMode]   = useState('cards'); // 'cards' | 'table'

  /* Modal */
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [activeSection, setActiveSection] = useState('account');
  const photoInputRef = useRef();

  /* ── Validation schema ───────────────────────────────────────── */
  const staffSchema = {
    name:              [rules.required('Full name')],
    email:             [rules.required('Email'), rules.email()],
    password:          editing ? [] : [rules.required('Password'), rules.minLength(8, 'Password'), rules.hasNumber('Password')],
    phone:             [rules.phone()],
    ghana_card_number: [rules.ghanaCard()],
    emergency_phone:   [rules.phone('Emergency phone')],
  };
  const { errors: fe, validateAll: va, clearError: ce, clearAll: ca } = useFormValidation(staffSchema);

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (pendingOnly) {
        params.role = 'customer_support';
        params.is_active = 'false';
      } else if (filterRole) {
        params.role = filterRole;
      }
      if (search) params.search = search;
      const res = await usersAPI.getAll(params);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterRole, pendingOnly]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); },  [search, filterRole, pendingOnly]);

  /* ── Open add / edit ────────────────────────────────────────── */
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveSection('account');
    ca();
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      name:               user.name               || '',
      email:              user.email              || '',
      password:           '',
      role:               user.role               || 'cashier',
      phone:              user.phone              || '',
      date_of_birth:      user.date_of_birth      ? user.date_of_birth.split('T')[0] : '',
      gender:             user.gender             || '',
      address:            user.address            || '',
      ghana_card_number:  user.ghana_card_number  || '',
      start_date:         user.start_date         ? user.start_date.split('T')[0] : '',
      emergency_name:     user.emergency_name     || '',
      emergency_phone:    user.emergency_phone    || '',
      emergency_relation: user.emergency_relation || '',
      passport_photo:     user.passport_photo     || '',
      notes:              user.notes              || '',
    });
    setActiveSection('account');
    setShowModal(true);
  };

  /* ── Handle passport photo upload ───────────────────────────── */
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Photo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, passport_photo: reader.result }));
    reader.readAsDataURL(file);
  };

  /* ── Save ────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!va(form)) return;
    if (form.role === 'super_admin' && !isSuperAdmin) return alert('Only Super Admin can assign the Super Admin role');

    try {
      setSaving(true);
      if (editing) {
        const data = { ...form };
        delete data.password; // don't send empty password on edit
        await usersAPI.update(editing.id, data);
      } else {
        await usersAPI.create(form);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving staff member');
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle ──────────────────────────────────────────────────── */
  const handleToggle = async (user) => {
    const isPendingApproval = !user.is_active && user.role === 'customer_support';
    const action = user.is_active ? 'Deactivate' : isPendingApproval ? 'Approve' : 'Activate';
    if (!window.confirm(`${action} ${user.name}?`)) return;
    try {
      await usersAPI.toggle(user.id);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  /* ── Delete (super_admin only) ───────────────────────────────── */
  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.name}? This cannot be undone.`)) return;
    try {
      await usersAPI.delete(user.id);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting staff member');
    }
  };

  /* ── Form sections ───────────────────────────────────────────── */
  const sections = [
    { key: 'account',   label: '👤 Account' },
    { key: 'personal',  label: '📋 Personal' },
    { key: 'emergency', label: '🚨 Emergency' },
    { key: 'photo',     label: '📸 Photo & Notes' },
  ];

  const f = (field) => ({
    className: 'form-input',
    value: form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  /* ── Role options — hide super_admin from non-super-admins ───── */
  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter(r => r !== 'super_admin');

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">{total} staff members</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px' }}
              onClick={() => setViewMode('cards')}
            >⊞ Cards</button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px' }}
              onClick={() => setViewMode('table')}
            >☰ Table</button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="🔍 Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={filterRole}
            onChange={e => { setFilterRole(e.target.value); setPendingOnly(false); }}
            disabled={pendingOnly}
          >
            <option value="">All roles</option>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
          {isSuperAdmin && (
            <button
              className={`btn btn-sm ${pendingOnly ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPendingOnly(p => !p); setFilterRole(''); }}
            >
              ⏳ Pending Approval
            </button>
          )}
          {(search || filterRole || pendingOnly) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterRole(''); setPendingOnly(false); }}>
              Clear
            </button>
          )}
          <span className="pagination-info">{total} result{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Loading staff…</span>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>No staff members found</h3>
          <p>{search || filterRole ? 'No staff match your filters.' : 'Add your first staff member to get started.'}</p>
          {!search && !filterRole && (
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Staff</button>
          )}
        </div>
      ) : (
        <>
          {/* Card grid view */}
          {viewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {users.map(user => (
                <ProfileCard
                  key={user.id}
                  user={user}
                  currentUser={currentUser}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Ghana Card</th>
                      <th>Start Date</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const isSelf = user.id === currentUser?.id;
                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {user.passport_photo ? (
                                <img src={user.passport_photo} alt={user.name}
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{
                                  width: '32px', height: '32px', borderRadius: '50%',
                                  background: ROLE_AVATAR[user.role] || '#64748b',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontWeight: '800', fontSize: '12px', flexShrink: 0,
                                }}>
                                  {user.name?.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: '600' }}>{user.name} {isSelf && <span className="badge badge-navy" style={{ fontSize: '9px' }}>You</span>}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className={ROLE_BADGE[user.role] || 'badge badge-gray'}>{user.role?.replace('_', ' ')}</span></td>
                          <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{user.phone || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-2)' }}>{user.ghana_card_number || '—'}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                            {user.start_date ? new Date(user.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td><span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {user.last_login ? new Date(user.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(user)}>Edit</button>
                              {!isSelf && isSuperAdmin && (
                                <>
                                  <button
                                    className={`btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}`}
                                    onClick={() => handleToggle(user)}
                                  >
                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user)}>Delete</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination" style={{ marginTop: '16px' }}>
              <span className="pagination-info">Page {page} of {pages} · {total} staff</span>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          Staff Profile Modal
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editing ? `Edit — ${editing.name}` : 'Add Staff Member'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Section tabs */}
            <div className="tabs" style={{ marginBottom: '20px' }}>
              {sections.map(s => (
                <button
                  key={s.key}
                  className={`tab-btn${activeSection === s.key ? ' active' : ''}`}
                  onClick={() => setActiveSection(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* ── Section: Account ───────────────────────────── */}
            {activeSection === 'account' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input {...f('name')} style={inputStyle(fe.name)} placeholder="e.g. Ama Owusu" onChange={e => { setForm(p=>({...p,name:e.target.value})); ce('name'); }} />
              <FormError error={fe.name} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input {...f('email')} type="email" style={inputStyle(fe.email)} placeholder="e.g. ama@procyclone.com" onChange={e => { setForm(p=>({...p,email:e.target.value})); ce('email'); }} />
              <FormError error={fe.email} />
                </div>
                {!editing && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input {...f('password')} type="password" style={inputStyle(fe.password)} placeholder="Min 8 characters, 1 number" onChange={e => { setForm(p=>({...p,password:e.target.value})); ce('password'); }} />
              <FormError error={fe.password} />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select {...f('role')}>
                      {availableRoles.map(r => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input {...f('phone')} style={inputStyle(fe.phone)} placeholder="e.g. 0244123456" onChange={e => { setForm(p=>({...p,phone:e.target.value})); ce('phone'); }} />
              <FormError error={fe.phone} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input {...f('start_date')} type="date" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Section: Personal ──────────────────────────── */}
            {activeSection === 'personal' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input {...f('date_of_birth')} type="date" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select {...f('gender')}>
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
                  <textarea {...f('address')} rows={2} placeholder="e.g. Madina, Accra" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ghana Card Number</label>
                  <input {...f('ghana_card_number')} style={{fontFamily:'monospace',...inputStyle(fe.ghana_card_number)}} placeholder="GHA-000000000-0" onChange={e => { setForm(p=>({...p,ghana_card_number:e.target.value})); ce('ghana_card_number'); }} />
                  <FormError error={fe.ghana_card_number} />
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>
                    Format: GHA-XXXXXXXXX-X
                  </p>
                </div>
              </div>
            )}

            {/* ── Section: Emergency Contact ─────────────────── */}
            {activeSection === 'emergency' && (
              <div>
                <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                  This contact will be reached in case of an emergency involving this staff member.
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input {...f('emergency_name')} placeholder="e.g. Kofi Mensah" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input {...f('emergency_phone')} style={inputStyle(fe.emergency_phone)} placeholder="e.g. 0201234567" onChange={e => { setForm(p=>({...p,emergency_phone:e.target.value})); ce('emergency_phone'); }} />
                  <FormError error={fe.emergency_phone} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <select {...f('emergency_relation')}>
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
              </div>
            )}

            {/* ── Section: Photo & Notes ─────────────────────── */}
            {activeSection === 'photo' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Passport Photo</label>

                  {/* Preview */}
                  {form.passport_photo && (
                    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                      <img
                        src={form.passport_photo}
                        alt="Passport"
                        style={{
                          width: '120px', height: '150px', objectFit: 'cover',
                          borderRadius: '8px', border: '2px solid var(--border)',
                        }}
                      />
                    </div>
                  )}

                  {/* Upload area */}
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border)', borderRadius: '10px',
                      padding: '24px', textAlign: 'center', cursor: 'pointer',
                      background: '#f8fafc', transition: 'border-color .2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📸</div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px', fontSize: '14px' }}>
                      {form.passport_photo ? 'Click to change photo' : 'Click to upload passport photo'}
                    </p>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: 0 }}>
                      JPG or PNG · Max 2MB · Passport size recommended
                    </p>
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    style={{ display: 'none' }}
                    onChange={handlePhotoUpload}
                  />
                  {form.passport_photo && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: '8px' }}
                      onClick={() => setForm(f => ({ ...f, passport_photo: '' }))}
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    {...f('notes')}
                    rows={3}
                    placeholder="Any additional notes about this staff member…"
                  />
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
