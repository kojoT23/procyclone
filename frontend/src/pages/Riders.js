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

  const fetchData = async () => {
    try {
      const [r, o] = await Promise.all([ridersAPI.getAll(), ordersAPI.getAll()]);
      setRiders(r.data.riders);
      setOrders(o.data.orders.filter(o => o.status === 'confirmed' || o.status === 'pending'));
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
    setForm({ name: rider.name, phone: rider.phone, vehicle_type: rider.vehicle_type||'', vehicle_number: rider.vehicle_number||'' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editRider) {
        await ridersAPI.update(editRider.id, form);
        alert('Rider updated!');
      } else {
        await ridersAPI.create(form);
        alert('Rider added!');
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

  if (loading) return <div style={{padding:'24px'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',margin:0}}>Riders</h1>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={() => setShowAssign(!showAssign)} style={{padding:'10px 20px',background:'#f39c12',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
            Assign Delivery
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{padding:'10px 20px',background:'#1a1a2e',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
            {showForm ? 'Cancel' : '+ Add Rider'}
          </button>
        </div>
      </div>

      {showAssign && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>Assign Delivery</h2>
          <form onSubmit={handleAssign}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Select Order</label>
                <select value={assign.order_id} onChange={e => setAssign({...assign, order_id: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} required>
                  <option value="">Select order</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name||'N/A'} - GH{Number(o.total_amount).toFixed(2)}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Select Rider</label>
                <select value={assign.rider_id} onChange={e => setAssign({...assign, rider_id: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} required>
                  <option value="">Select rider</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name} - {r.phone}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button type="button" onClick={() => setShowAssign(false)} style={{padding:'10px 20px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>Cancel</button>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>Assign</button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>{editRider ? 'Edit Rider' : 'Add New Rider'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Full Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Enter full name" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Phone Number</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="e.g. 0244123456" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Vehicle Type</label>
                <input value={form.vehicle_type} onChange={e => setForm({...form, vehicle_type: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="e.g. Motorbike, Bicycle" />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Vehicle Number</label>
                <input value={form.vehicle_number} onChange={e => setForm({...form, vehicle_number: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="e.g. GR-1234-22" />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button type="button" onClick={handleCancel} style={{padding:'10px 20px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>Cancel</button>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>{editRider ? 'Update Rider' : 'Add Rider'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{background:'white',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f8f9fa'}}>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Name</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Phone</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Vehicle</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Status</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {riders.length === 0
              ? <tr><td colSpan="5" style={{textAlign:'center',padding:'40px',color:'#999'}}>No riders yet</td></tr>
              : riders.map(rider => (
                <tr key={rider.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                  <td style={{padding:'12px',fontSize:'14px',fontWeight:'500'}}>{rider.name}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{rider.phone}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{rider.vehicle_type||'-'} {rider.vehicle_number ? '('+rider.vehicle_number+')' : ''}</td>
                  <td style={{padding:'12px'}}>
                    <span style={{padding:'3px 10px',borderRadius:'20px',color:'white',fontSize:'12px',background: rider.is_available ? '#2ecc71' : '#e74c3c'}}>
                      {rider.is_available ? 'Available' : 'Busy'}
                    </span>
                  </td>
                  <td style={{padding:'12px',display:'flex',gap:'4px'}}>
                    <button onClick={() => window.open('https://wa.me/'+rider.phone.replace(/[^0-9]/g,''), '_blank')} style={{padding:'4px 12px',background:'#25D366',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>WhatsApp</button>
                    <button onClick={() => handleEdit(rider)} style={{padding:'4px 12px',background:'#3498db',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Edit</button>
                    <button onClick={() => handleDelete(rider.id)} style={{padding:'4px 12px',background:'#e74c3c',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Remove</button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Riders;

