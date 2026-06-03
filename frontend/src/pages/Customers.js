import React, { useState, useEffect, useCallback } from 'react';
import { customersAPI } from '../utils/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const res = await customersAPI.getAll(params);
      setCustomers(res.data.customers || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(1); }, [search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return alert('Name and phone are required');
    try {
      setSaving(true);
      if (editing) {
        await customersAPI.update(editing.id, form);
      } else {
        await customersAPI.create(form);
      }
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
      fetchCustomers();
    } catch (err) {
      alert('Error deleting customer');
    }
  };

  const sendWhatsApp = (customer) => {
    const phone = customer.phone?.replace(/\D/g, '');
    const intlPhone = phone?.startsWith('0') ? '233' + phone.slice(1) : phone;
    window.open(`https://wa.me/${intlPhone}`, '_blank');
  };

  const avatarColor = (name) => {
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#14b8a6','#ef4444','#22c55e'];
    return colors[name?.charCodeAt(0) % colors.length] || '#3b82f6';
  };

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
      <div className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <p className="loading-text">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">��</div>
            <h3>No customers yet</h3>
            <p>Add your first customer to get started</p>
            <button className="btn btn-primary" style={{ marginTop: '4px' }} onClick={openAdd}>+ Add Customer</button>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="avatar"
                            style={{ background: avatarColor(customer.name) }}
                          >
                            {customer.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600' }}>{customer.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '500', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{customer.phone}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{customer.email || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: '13px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => sendWhatsApp(customer)}
                            data-tip="WhatsApp"
                            style={{ padding: '6px 10px' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(customer)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(customer)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="pagination-info">Page {page} of {pages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
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
              <h2 className="modal-title">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kofi Mensah" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0244123456" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <textarea className="form-input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Accra, East Legon" />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
