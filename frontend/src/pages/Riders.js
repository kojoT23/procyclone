import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI } from '../utils/api';

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });

  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const res = await ridersAPI.getAll(params);
      setRiders(res.data.riders || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);
  useEffect(() => { setPage(1); }, [search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
    setShowModal(true);
  };

  const openEdit = (rider) => {
    setEditing(rider);
    setForm({
      name: rider.name || '',
      phone: rider.phone || '',
      vehicle_type: rider.vehicle_type || '',
      vehicle_number: rider.vehicle_number || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return alert('Name and phone are required');
    try {
      setSaving(true);
      if (editing) {
        await ridersAPI.update(editing.id, form);
      } else {
        await ridersAPI.create(form);
      }
      setShowModal(false);
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving rider');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this rider?')) return;
    try {
      await ridersAPI.delete(id);
      fetchRiders();
    } catch (err) {
      alert('Error removing rider');
    }
  };

  const sendWhatsApp = (rider) => {
    const phone = rider.phone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>{total} riders</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Rider</button>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="search-input"
            placeholder="🔍 Search riders..."
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
          <div className="loading">Loading riders...</div>
        ) : riders.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏍️</div>
            <h3>No riders yet</h3>
            <p>Add your first rider to get started</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Rider</button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Phone</th>
                    <th>Vehicle</th>
                    <th>Plate</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {riders.map(rider => (
                    <tr key={rider.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: '#e67e22', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '13px', flexShrink: 0,
                          }}>
                            {rider.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600' }}>{rider.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '500' }}>{rider.phone}</td>
                      <td style={{ color: '#666', textTransform: 'capitalize' }}>{rider.vehicle_type || '—'}</td>
                      <td style={{ color: '#666', fontWeight: '500' }}>{rider.vehicle_number || '—'}</td>
                      <td>
                        <span style={{
                          background: rider.is_available ? '#d4edda' : '#f8d7da',
                          color: rider.is_available ? '#155724' : '#721c24',
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600',
                        }}>
                          {rider.is_available ? 'Available' : 'Busy'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => sendWhatsApp(rider)} title="WhatsApp">💬</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEdit(rider)}>Edit</button>
                          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleDelete(rider.id)}>Remove</button>
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
              <h2 className="modal-title">{editing ? 'Edit Rider' : 'Add Rider'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kwame Asante" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0244123456" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Vehicle Type</label>
                <select className="form-input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="bicycle">Bicycle</option>
                  <option value="car">Car</option>
                  <option value="tricycle">Tricycle</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plate / Vehicle #</label>
                <input className="form-input" value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. GR-1234-21" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Riders;
