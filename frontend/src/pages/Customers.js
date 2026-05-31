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

  const sendWhatsApp = (customer) => {
    const phone = customer.phone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>{total} customers</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="�� Search by name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-secondary" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <h3>No customers yet</h3>
            <p>Add your first customer to get started</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Customer</button>
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
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: '#1a1a2e', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '13px', flexShrink: 0,
                          }}>
                            {customer.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600' }}>{customer.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '500' }}>{customer.phone}</td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{customer.email || '—'}</td>
                      <td style={{ color: '#666', fontSize: '13px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address || '—'}</td>
                      <td style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => sendWhatsApp(customer)} title="WhatsApp">��</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(customer)}>Edit</button>
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
              <h2 className="modal-title">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
