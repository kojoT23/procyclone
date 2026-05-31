import React, { useState, useEffect } from 'react';
import { cashAPI, ridersAPI, ordersAPI } from '../utils/api';

const Cash = () => {
  const [cashLogs, setCashLogs] = useState([]);
  const [riders, setRiders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rider_id: '', order_id: '', amount: '', notes: '' });

  const fetchData = async () => {
    try {
      const [c, r, o, rep] = await Promise.all([cashAPI.getAll(), ridersAPI.getAll(), ordersAPI.getAll(), cashAPI.getDailyReport()]);
      setCashLogs(c.data.cash_logs);
      setRiders(r.data.riders);
      setOrders(o.data.orders.filter(o => o.payment_method === 'cash' && o.payment_status === 'unpaid'));
      setReport(rep.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await cashAPI.create(form);
      alert('Cash log created!');
      setShowForm(false);
      setForm({ rider_id: '', order_id: '', amount: '', notes: '' });
      fetchData();
    } catch (err) { alert('Error creating cash log'); }
  };

  const handleVerify = async (id) => {
    try {
      await cashAPI.verify(id);
      alert('Cash verified!');
      fetchData();
    } catch (err) { alert('Error verifying cash'); }
  };

  const getStatusColor = (s) => ({ collected: '#f39c12', submitted: '#3498db', verified: '#2ecc71' }[s] || '#999');

  if (loading) return <div style={{padding:'24px'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',marginBottom:'24px'}}>Cash Control</h1>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'16px',marginBottom:'24px'}}>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderTop:'4px solid #2ecc71'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Total Cash Today</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>GH{Number(report?.cash?.total_cash_collected||0).toFixed(2)}</h3>
        </div>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderTop:'4px solid #3498db'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Total Orders Today</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>{report?.orders?.total_orders||0}</h3>
        </div>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderTop:'4px solid #f39c12'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Total Revenue Today</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>GH{Number(report?.orders?.total_revenue||0).toFixed(2)}</h3>
        </div>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderTop:'4px solid #9b59b6'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Delivered Today</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>{report?.orders?.delivered||0}</h3>
        </div>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <h2 style={{fontSize:'18px',fontWeight:'600',color:'#1a1a2e',margin:0}}>Cash Logs</h2>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'10px 20px',background:'#1a1a2e',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
          {showForm ? 'Cancel' : '+ Log Cash'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>Log Cash Collection</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Rider</label>
                <select value={form.rider_id} onChange={e => setForm({...form, rider_id: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} required>
                  <option value="">Select rider</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Order</label>
                <select value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}}>
                  <option value="">Select order (optional)</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} - GH{Number(o.total_amount).toFixed(2)}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Amount (GH)</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="0.00" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button type="button" onClick={() => setShowForm(false)} style={{padding:'10px 20px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>Cancel</button>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>Log Cash</button>
            </div>
          </form>
        </div>
      )}

      <div style={{background:'white',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f8f9fa'}}>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Rider</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Order</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Amount</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Status</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Time</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cashLogs.length === 0
              ? <tr><td colSpan="6" style={{textAlign:'center',padding:'40px',color:'#999'}}>No cash logs yet</td></tr>
              : cashLogs.map(log => (
                <tr key={log.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                  <td style={{padding:'12px',fontSize:'14px',fontWeight:'500'}}>{log.rider_name||'N/A'}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{log.order_number||'-'}</td>
                  <td style={{padding:'12px',fontSize:'14px',fontWeight:'500'}}>GH{Number(log.amount).toFixed(2)}</td>
                  <td style={{padding:'12px'}}>
                    <span style={{padding:'3px 10px',borderRadius:'20px',color:'white',fontSize:'12px',background:getStatusColor(log.status)}}>{log.status}</span>
                  </td>
                  <td style={{padding:'12px',fontSize:'13px',color:'#999'}}>{new Date(log.collected_at).toLocaleString()}</td>
                  <td style={{padding:'12px'}}>
                    {log.status !== 'verified' && (
                      <button onClick={() => handleVerify(log.id)} style={{padding:'4px 12px',background:'#2ecc71',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Verify</button>
                    )}
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

export default Cash;