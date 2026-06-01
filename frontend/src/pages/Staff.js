import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '../utils/api';

const ROLE_COLORS = {
  super_admin: { bg: '#f8d7da', text: '#721c24' },
  admin:       { bg: '#ffd6a5', text: '#7d4e00' },
  manager:     { bg: '#cce5ff', text: '#004085' },
  cashier:     { bg: '#d4edda', text: '#155724' },
  dispatcher:  { bg: '#e2d9f3', text: '#4a235a' },
  warehouse:   { bg: '#d1ecf1', text: '#0c5460' },
  rider:       { bg: '#fff3cd', text: '#856404' },
};

const ROLES = ['super_admin','admin','manager','cashier','dispatcher','warehouse','rider'];

const Staff = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier', phone: '' });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      const res = await usersAPI.getAll(params);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search, filterRole]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'cashier', phone: '' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'cashier', phone: user.phone || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Name and email are required');
    if (!editing && !form.password) return alert('Password is required for new staff');
    try {
      setSaving(true);
      if (editing) {
        const data = { name: form.name, email: form.email, role: form.role, phone: form.phone };
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

  const handleToggle = async (user) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`${action} ${user.name}?`)) return;
    try {
      await usersAPI.toggle(user.id);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>{total} staff members</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
      </div>

      {/* Search + filter */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="🔍 Search by name, email or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
          {(search || filterRole) && (
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setFilterRole(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading staff...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👤</div>
            <h3>No staff members yet</h3>
            <p>Add your first staff member to get started</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Staff</button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: ROLE_COLORS[user.role]?.text || '#666',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 'bold', fontSize: '13px', flexShrink: 0,
                          }}>
                            {user.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600' }}>{user.name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{user.email}</td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{user.phone || '—'}</td>
                      <td>
                        <span style={{
                          background: ROLE_COLORS[user.role]?.bg || '#eee',
                          color: ROLE_COLORS[user.role]?.text || '#333',
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600', textTransform: 'capitalize', whiteSpace: 'nowrap',
                        }}>
                          {user.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: user.is_active ? '#d4edda' : '#f8d7da',
                          color: user.is_active ? '#155724' : '#721c24',
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600',
                        }}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(user)}>Edit</button>
                          <button
                            className={user.is_active ? 'btn btn-danger' : 'btn btn-success'}
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleToggle(user)}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {pages}</span>
                <button className="btn btn-secondary" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ama Owusu" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. ama@procyclone.com" />
            </div>
            {!editing && (
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters, 1 number" />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0244123456" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
