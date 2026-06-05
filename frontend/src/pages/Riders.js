import React, { useState, useEffect } from 'react';
import { ridersAPI, ordersAPI } from '../utils/api';

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRider, setEditRider] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('orders');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRider, setSelectedRider] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  const fetchData = async () => {
    try {
      const [r, o] = await Promise.all([ridersAPI.getAll(), ordersAPI.getAll()]);
      setRiders(r.data.riders || []);
      setOrders(o.data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const openAssignModal = (order) => {
    setSelectedOrder(order);
    setSelectedRider('');
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedRider) return alert('Please select a rider');
    try {
      await ridersAPI.assignDelivery({ order_id: selectedOrder.id, rider_id: parseInt(selectedRider) });
      setShowAssignModal(false);
      setSelectedOrder(null);
      await fetchData();
    } catch (err) {
      alert('Error assigning: ' + (err.response?.data?.message || err.message));
    }
  };

  const handlePickedUp = async (order) => {
    if (!window.confirm('Mark ' + order.order_number + ' as Picked Up?')) return;
    try {
      const fresh = await ordersAPI.getOne(order.id);
      const deliveryId = fresh.data && fresh.data.order && fresh.data.order.delivery_id;
      if (deliveryId) {
        await ridersAPI.updateDeliveryStatus(deliveryId, { status: 'picked_up' });
      } else {
        await ordersAPI.updateStatus(order.id, { status: 'processing' });
      }
      await fetchData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelivered = async (order) => {
    if (!window.confirm('Mark ' + order.order_number + ' as Delivered?')) return;
    try {
      const fresh = await ordersAPI.getOne(order.id);
      const deliveryId = fresh.data && fresh.data.order && fresh.data.order.delivery_id;
      if (deliveryId) {
        await ridersAPI.updateDeliveryStatus(deliveryId, { status: 'delivered' });
      } else {
        await ordersAPI.updateStatus(order.id, { status: 'delivered' });
      }
      await fetchData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = async (rider) => {
    setEditRider(rider);
    setForm({ name: rider.name, phone: rider.phone, vehicle_type: rider.vehicle_type || '', vehicle_number: rider.vehicle_number || '' });
    setShowForm(true);
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
      await fetchData();
    } catch (err) {
      alert('Error saving rider');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Remove this rider?')) {
      try {
        await ridersAPI.delete(id);
        await fetchData();
      } catch (err) {
        alert('Error removing rider');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditRider(null);
    setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
  };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'active') return ['pending', 'confirmed', 'processing'].includes(o.status);
    if (filterStatus === 'delivered') return o.status === 'delivered';
    if (filterStatus === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  const filteredRiders = riders.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  const available = riders.filter(r => r.is_available).length;
  const busy = riders.filter(r => !r.is_available).length;
  const activeOrders = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length;

  const statusBadge = (status) => {
    const map = { pending: 'badge-amber', confirmed: 'badge-blue', processing: 'badge-purple', delivered: 'badge-green', cancelled: 'badge-red' };
    return map[status] || 'badge-gray';
  };

  const formatCurrency = (amount) => 'GHS ' + parseFloat(amount || 0).toFixed(2);
  const formatDate = (d) => d ? new Date(d).toLocaleString('en-GH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading...</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders and Deliveries</h1>
          <p className="page-subtitle">Manage riders and track order delivery workflow</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          
          {activeTab === 'riders' && (
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditRider(null); setForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' }); }}>
              + Add Rider
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ '--accent-color': '#f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div>
            <div className="stat-label">Active Orders</div>
            <div className="stat-value">{activeOrders}</div>
            <div className="stat-sub">Needs action</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--accent)' }}>
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-label">Available Riders</div>
            <div className="stat-value">{available}</div>
            <div className="stat-sub">Ready to assign</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#ef4444' }}>
          <div className="stat-icon">🚴</div>
          <div>
            <div className="stat-label">On Delivery</div>
            <div className="stat-value">{busy}</div>
            <div className="stat-sub">Currently out</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#3b82f6' }}>
          <div className="stat-icon">🏍️</div>
          <div>
            <div className="stat-label">Total Riders</div>
            <div className="stat-value">{riders.length}</div>
            <div className="stat-sub">Registered</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab-btn' + (activeTab === 'orders' ? ' active' : '')} onClick={() => setActiveTab('orders')}>
          Order Workflow
          {activeOrders > 0 && <span className="badge badge-amber" style={{ marginLeft: '0.5rem' }}>{activeOrders}</span>}
        </button>
        <button className={'tab-btn' + (activeTab === 'riders' ? ' active' : '')} onClick={() => setActiveTab('riders')}>
          Riders
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Orders</h3>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[
                { key: 'active', label: 'Active' },
                { key: 'delivered', label: 'Delivered' },
                { key: 'cancelled', label: 'Cancelled' },
                { key: 'all', label: 'All' },
              ].map(t => (
                <button key={t.key} className={'tab-btn' + (filterStatus === t.key ? ' active' : '')} onClick={() => setFilterStatus(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <p>No orders in this category</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Rider</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td><strong>{order.order_number}</strong></td>
                      <td>
                        <div>{order.customer_name || '—'}</div>
                        {order.delivery_address && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{order.delivery_address}</div>
                        )}
                      </td>
                      <td>
                        {order.rider_name
                          ? <span className="badge badge-blue">{order.rider_name}</span>
                          : <span className="badge badge-gray">Unassigned</span>
                        }
                      </td>
                      <td><strong>{formatCurrency(order.total_amount)}</strong></td>
                      <td><span className={'badge ' + statusBadge(order.status)}>{order.status}</span></td>
                      <td style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>{formatDate(order.created_at)}</td>
                      <td>
                        {order.status === 'pending' && (
                          <button className="btn btn-sm btn-blue" onClick={() => openAssignModal(order)}>Assign Rider</button>
                        )}
                        {order.status === 'confirmed' && (
                          <button className="btn btn-sm btn-warning" onClick={() => handlePickedUp(order)}>Picked Up</button>
                        )}
                        {order.status === 'processing' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleDelivered(order)}>Delivered</button>
                        )}
                        {order.status === 'delivered' && (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Complete</span>
                        )}
                        {order.status === 'cancelled' && (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Cancelled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'riders' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Riders</h3>
            <div className="search-bar">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input className="search-input" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {filteredRiders.length === 0 ? (
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
                  {filteredRiders.map(rider => (
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
                        {rider.vehicle_number && <span style={{ color: 'var(--text-3)', marginLeft: '0.4rem', fontSize: '0.82rem' }}>({rider.vehicle_number})</span>}
                      </td>
                      <td>
                        <span className={'badge ' + (rider.is_available ? 'badge-green' : 'badge-red')}>
                          {rider.is_available ? 'Available' : 'Busy'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-sm" style={{ background: '#25D366', color: 'white', border: 'none' }} onClick={() => window.open('https://wa.me/' + rider.phone.replace(/[^0-9]/g, ''), '_blank')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.554 4.107 1.523 5.83L0 24l6.338-1.498A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.732.882.899-3.641-.235-.374A9.818 9.818 0 1 1 12 21.818z" />
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
      )}

      {showAssignModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Rider</h2>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>x</button>
            </div>
            <div className="card" style={{ background: 'var(--bg)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.order_number}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{selectedOrder.customer_name}</div>
                  {selectedOrder.delivery_address && <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{selectedOrder.delivery_address}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(selectedOrder.total_amount)}</div>
                  <span className={'badge ' + statusBadge(selectedOrder.status)}>{selectedOrder.status}</span>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Select Rider</label>
              <select className="form-input" value={selectedRider} onChange={e => setSelectedRider(e.target.value)}>
                <option value="">Choose a rider...</option>
                {riders.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} - {r.phone} - {r.is_available ? 'Available' : 'Busy'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign}>Assign and Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editRider ? 'Edit Rider' : 'Add New Rider'}</h2>
              <button className="modal-close" onClick={handleCancel}>x</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0244123456" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Type</label>
                  <input className="form-input" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} placeholder="e.g. Motorbike, Bicycle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-input" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. GR-1234-22" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                <button type="submit" className="btn btn-success">{editRider ? 'Update Rider' : 'Add Rider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Riders;
