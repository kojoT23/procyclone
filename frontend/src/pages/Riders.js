import React, { useState, useEffect } from 'react';
import { ridersAPI, ordersAPI } from '../utils/api';

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [editRider, setEditRider] = useState(null);
  const [assign, setAssign] = useState({ order_id: '', rider_id: '' });
  const [form, setForm] = useState({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [r, o] = await Promise.all([ridersAPI.getAll(), ordersAPI.getAll()]);
      setRiders(r.data.riders || []);
      setOrders((o.data.orders || []).filter(o => o.status === 'confirmed' || o.status === 'pending'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEdit = (rider) => {
    setEditRider(rider);
    setForm({ name: rider.name, phone: rider.phone, vehicle_type: rider.vehicle_type || '', vehicle_number: rider.vehicle_number || '' });
    setShowForm(true);
    setShowAssign(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editRider) {
        await ridersAPI.update(editRider.id, form);
      } else {
        await ridersAPI.create(form);
      }
      setShowForm(false);
      setEditRider(null);
      setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
      fetchData();
    } catch (err) { alert('Error saving rider'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Remove this rider?')) {
      try { await ridersAPI.delete(id); fetchData(); }
      catch (err) { alert('Error removing rider'); }
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await ridersAPI.assignDelivery(assign);
      alert('Delivery assigned!');
      setShowAssign(false);
      setAssign({ order_id: '', rider_id: '' });
      fetchData();
    } catch (err) { alert('Error assigning delivery'); }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditRider(null);
    setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
  };

  const filtered = riders.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  const available = riders.filter(r => r.is_available).length;
  const busy = riders.filter(r => !r.is_available).length;

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner"/>
      <span className="loading-text">Loading riders...</span>
    </div>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders</h1>
          <p className="page-subtitle">Manage delivery riders and assign orders</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-warning" onClick={() => { setShowAssign(!showAssign); setShowForm(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Assign Delivery
          </button>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setShowAssign(false); setEditRider(null); setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' }); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Rider
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ '--accent-color': 'var(--accent)' }}>
          <div className="stat-icon">🏍️</div>
          <div>
            <div className="stat-label">Total Riders</div>
            <div className="stat-value">{riders.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#22c55e' }}>
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-label">Available</div>
            <div className="stat-value">{available}</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#ef4444' }}>
          <div className="stat-icon">🚴</div>
          <div>
            <div className="stat-label">On Delivery</div>
            <div className="stat-value">{busy}</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#3b82f6' }}>
          <div className="stat-icon">📦</div>
          <div>
            <div className="stat-label">Pending Orders</div>
            <div className="stat-value">{orders.length}</div>
          </div>
        </div>
      </div>

      {/* Assign Delivery Modal */}
      {showAssign && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Delivery</h2>
              <button className="modal-close" onClick={() => setShowAssign(false)}>✕</button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label className="form-label">Select Order</label>
                <select
                  className="form-input"
                  value={assign.order_id}
                  onChange={e => setAssign({ ...assign, order_id: e.target.value })}
                  required
                >
                  <option value="">Choose an order...</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name || 'N/A'} — GHS {Number(o.total_amount).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Rider</label>
                <select
                  className="form-input"
                  value={assign.rider_id}
                  onChange={e => setAssign({ ...assign, rider_id: e.target.value })}
                  required
                >
                  <option value="">Choose a rider...</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.phone} — {r.is_available ? 'Available' : 'Busy'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Assign Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Rider Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editRider ? 'Edit Rider' : 'Add New Rider'}</h2>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. 0244123456"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Type</label>
                  <input
                    className="form-input"
                    value={form.vehicle_type}
                    onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                    placeholder="e.g. Motorbike, Bicycle"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input
                    className="form-input"
                    value={form.vehicle_number}
                    onChange={e => setForm({ ...form, vehicle_number: e.target.value })}
                    placeholder="e.g. GR-1234-22"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                <button type="submit" className="btn btn-success">
                  {editRider ? 'Update Rider' : 'Add Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Riders</h3>
          <div className="search-bar">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏍️</div>
            <p>No riders found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Rider</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rider => (
                  <tr key={rider.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--navy)', color: 'var(--accent)', fontWeight: 700 }}>
                          {rider.name?.charAt(0).toUpperCase()}
                        </div>
                        <strong>{rider.name}</strong>
                      </div>
                    </td>
                    <td>{rider.phone}</td>
                    <td>
                      {rider.vehicle_type || '—'}
                      {rider.vehicle_number && (
                        <span style={{ color: 'var(--text-3)', marginLeft: '0.4rem', fontSize: '0.82rem' }}>
                          ({rider.vehicle_number})
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${rider.is_available ? 'badge-green' : 'badge-red'}`}>
                        {rider.is_available ? 'Available' : 'Busy'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#25D366', color: 'white', border: 'none' }}
                          onClick={() => window.open('https://wa.me/' + rider.phone.replace(/[^0-9]/g, ''), '_blank')}
                          title="WhatsApp"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.554 4.107 1.523 5.83L0 24l6.338-1.498A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.732.882.899-3.641-.235-.374A9.818 9.818 0 1 1 12 21.818z"/>
                          </svg>
                        </button>
                        <button className="btn btn-sm btn-blue" onClick={() => handleEdit(rider)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(rider.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Riders;
