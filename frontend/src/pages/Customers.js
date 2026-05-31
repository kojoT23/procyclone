import React, { useState, useEffect } from 'react';
import { customersAPI } from '../utils/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const fetchData = async () => {
    try {
      const c = await customersAPI.getAll();
      setCustomers(c.data.customers);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEdit = (customer) => {
    setEditCustomer(customer);
    setForm({ name: customer.name, phone: customer.phone, email: customer.email||'', address: customer.address||'' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCustomer) {
        await customersAPI.update(editCustomer.id, form);
        alert('Customer updated!');
      } else {
        await customersAPI.create(form);
        alert('Customer created!');
      }
      setShowForm(false);
      setEditCustomer(null);
      setForm({ name: '', phone: '', email: '', address: '' });
      fetchData();
    } catch (err) { alert('Error saving customer'); }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditCustomer(null);
    setForm({ name: '', phone: '', email: '', address: '' });
  };

  if (loading) return <div style={{padding:'24px'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',margin:0}}>Customers</h1>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'10px 20px',background:'#1a1a2e',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
          {showForm ? 'Cancel' : '+ New Customer'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>{editCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
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
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Email (optional)</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="email@example.com" />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Enter address" />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button type="button" onClick={handleCancel} style={{padding:'10px 20px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>Cancel</button>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>{editCustomer ? 'Update Customer' : 'Add Customer'}</button>
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
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Email</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Address</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>WhatsApp</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0
              ? <tr><td colSpan="6" style={{textAlign:'center',padding:'40px',color:'#999'}}>No customers yet</td></tr>
              : customers.map(customer => (
                <tr key={customer.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                  <td style={{padding:'12px',fontSize:'14px',fontWeight:'500'}}>{customer.name}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{customer.phone}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{customer.email||'-'}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{customer.address||'-'}</td>
                  <td style={{padding:'12px'}}>
                    <button onClick={() => window.open('https://wa.me/' + customer.phone.replace(/[^0-9]/g,''), '_blank')} style={{padding:'4px 12px',background:'#25D366',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Message</button>
                  </td>
                  <td style={{padding:'12px'}}>
                    <button onClick={() => handleEdit(customer)} style={{padding:'4px 12px',background:'#3498db',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px',marginRight:'4px'}}>Edit</button>
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

export default Customers;