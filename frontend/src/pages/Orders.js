import React, { useState, useEffect } from 'react';
import { ordersAPI, customersAPI, productsAPI } from '../utils/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_id: '', payment_method: 'cash', delivery_address: '', notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0 }] });

  const fetchData = async () => {
    try {
      const [o, c, p] = await Promise.all([ordersAPI.getAll(), customersAPI.getAll(), productsAPI.getAll()]);
      setOrders(o.data.orders);
      setCustomers(c.data.customers);
      setProducts(p.data.products);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 15000); return () => clearInterval(interval); }, []);

  const handleProductChange = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], product_id: productId, unit_price: product ? product.price : 0 };
    setForm({ ...form, items: newItems });
  };

  const handleQtyChange = (index, qty) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], quantity: parseInt(qty) };
    setForm({ ...form, items: newItems });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_price: 0 }] });
  const removeItem = (index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  const getTotal = () => form.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await ordersAPI.create(form);
      setShowForm(false);
      setForm({ customer_id: '', payment_method: 'cash', delivery_address: '', notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0 }] });
      fetchData();
      alert('Order created!');
    } catch (err) { alert('Error creating order'); }
  };

  const handleStatus = async (id, status) => {
    try { await ordersAPI.updateStatus(id, { status }); fetchData(); }
    catch (err) { alert('Error updating status'); }
  };

  const handleWhatsApp = (order) => {
    const msg = encodeURIComponent('Hi! Your order ' + order.order_number + ' status is: ' + order.status + '. Total: GH' + Number(order.total_amount).toFixed(2));
    const phone = order.customer_phone ? order.customer_phone.replace(/[^0-9]/g, '') : '';
    window.open('https://wa.me/' + phone + '?text=' + msg, '_blank');
  };

  const handlePrint = (order) => {
    const win = window.open('', '_blank');
    win.document.write('<html><body style="font-family:Arial;padding:20px"><h2>Pro Cyclone</h2><hr><p><b>Order:</b> ' + order.order_number + '</p><p><b>Customer:</b> ' + (order.customer_name || 'N/A') + '</p><p><b>Phone:</b> ' + (order.customer_phone || 'N/A') + '</p><p><b>Address:</b> ' + (order.delivery_address || 'N/A') + '</p><p><b>Amount:</b> GH' + Number(order.total_amount).toFixed(2) + '</p><p><b>Payment:</b> ' + order.payment_method + '</p><p><b>Status:</b> ' + order.status + '</p><hr><p>Thank you!</p></body></html>');
    win.print();
  };

  const getStatusColor = (status) => ({ pending: '#f39c12', confirmed: '#3498db', assigned: '#9b59b6', picked_up: '#1abc9c', delivered: '#2ecc71', cancelled: '#e74c3c' }[status] || '#999');

  if (loading) return <div style={{padding:'24px'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',margin:0}}>Orders</h1>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'10px 20px',background:'#1a1a2e',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
          {showForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>Create New Order</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Customer</label>
                <select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} required>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Payment Method</label>
                <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}}>
                  <option value="cash">Cash</option>
                  <option value="momo">MoMo</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Delivery Address</label>
                <input value={form.delivery_address} onChange={e => setForm({...form, delivery_address: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Enter address" />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Optional notes" />
              </div>
            </div>
            <h3 style={{fontSize:'16px',fontWeight:'600',marginBottom:'12px'}}>Order Items</h3>
            {form.items.map((item, index) => (
              <div key={index} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:'8px',marginBottom:'8px',alignItems:'center'}}>
                <select value={item.product_id} onChange={e => handleProductChange(index, e.target.value)} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} - GH{p.price}</option>)}
                </select>
                <input type="number" min="1" value={item.quantity} onChange={e => handleQtyChange(index, e.target.value)} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'6px'}} />
                <input value={'GH' + (item.unit_price * item.quantity).toFixed(2)} readOnly style={{padding:'8px',border:'1px solid #ddd',borderRadius:'6px',background:'#f8f9fa'}} />
                {form.items.length > 1 && <button type="button" onClick={() => removeItem(index)} style={{padding:'8px',background:'#e74c3c',color:'white',border:'none',borderRadius:'6px',cursor:'pointer'}}>X</button>}
              </div>
            ))}
            <button type="button" onClick={addItem} style={{padding:'8px 16px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer',marginBottom:'16px'}}>+ Add Item</button>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0}}>Total: GH{getTotal().toFixed(2)}</h3>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'16px',fontWeight:'600'}}>Create Order</button>
            </div>
          </form>
        </div>
      )}

      <div style={{background:'white',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f8f9fa'}}>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Order #</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Customer</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Amount</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Payment</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Status</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign:'center',padding:'40px',color:'#999'}}>No orders yet</td></tr>
            ) : orders.map(order => (
              <tr key={order.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                <td style={{padding:'12px',fontSize:'14px'}}>{order.order_number}</td>
                <td style={{padding:'12px',fontSize:'14px'}}>{order.customer_name || 'N/A'}</td>
                <td style={{padding:'12px',fontSize:'14px'}}>GH{Number(order.total_amount).toFixed(2)}</td>
                <td style={{padding:'12px',fontSize:'14px'}}>{order.payment_method}</td>
                <td style={{padding:'12px'}}>
                  <span style={{padding:'3px 10px',borderRadius:'20px',color:'white',fontSize:'12px',background:getStatusColor(order.status)}}>{order.status}</span>
                </td>
                <td style={{padding:'12px',display:'flex',gap:'4px',flexWrap:'wrap'}}>
                  <select onChange={e => handleStatus(order.id, e.target.value)} value={order.status} style={{padding:'4px 8px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'12px'}}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="assigned">Assigned</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button onClick={() => handleWhatsApp(order)} style={{padding:'4px 8px',background:'#25D366',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>WhatsApp</button>
                  <button onClick={() => handlePrint(order)} style={{padding:'4px 8px',background:'#3498db',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Print</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;