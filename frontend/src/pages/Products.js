import React, { useState, useEffect } from 'react';
import { productsAPI } from '../utils/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock_quantity: '', low_stock_threshold: 5, category: '', image_url: '' });

  const fetchData = async () => {
    try {
      const p = await productsAPI.getAll();
      setProducts(p.data.products);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEdit = (product) => {
    setEditProduct(product);
    setForm({ name: product.name, description: product.description || '', price: product.price, stock_quantity: product.stock_quantity, low_stock_threshold: product.low_stock_threshold, category: product.category || '', image_url: product.image_url || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editProduct) {
        await productsAPI.update(editProduct.id, form);
        alert('Product updated!');
      } else {
        await productsAPI.create(form);
        alert('Product created!');
      }
      setShowForm(false);
      setEditProduct(null);
      setForm({ name: '', description: '', price: '', stock_quantity: '', low_stock_threshold: 5, category: '', image_url: '' });
      fetchData();
    } catch (err) { alert('Error saving product'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this product?')) {
      try { await productsAPI.delete(id); fetchData(); }
      catch (err) { alert('Error deleting product'); }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', stock_quantity: '', low_stock_threshold: 5, category: '', image_url: '' });
  };

  const handleCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      let created = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);
        if (row.name && row.price) {
          try {
            await productsAPI.create({ name: row.name, price: parseFloat(row.price), stock_quantity: parseInt(row.stock_quantity)||0, category: row.category||'', description: row.description||'' });
            created++;
          } catch (err) { console.error('Error importing row:', err); }
        }
      }
      alert(created + ' products imported!');
      fetchData();
    };
    reader.readAsText(file);
  };

  if (loading) return <div style={{padding:'24px'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',margin:0}}>Products</h1>
        <div style={{display:'flex',gap:'8px'}}>
          <label style={{padding:'10px 20px',background:'#f39c12',color:'white',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
            Import CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}} />
          </label>
          <button onClick={() => setShowForm(!showForm)} style={{padding:'10px 20px',background:'#1a1a2e',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
            {showForm ? 'Cancel' : '+ New Product'}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{background:'white',padding:'24px',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:'24px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'16px'}}>{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Product Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Enter product name" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Category</label>
                <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="e.g. Footwear, Clothing" />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Price (GH₵)</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="0.00" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Stock Quantity</label>
                <input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="0" required />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Low Stock Alert (when to warn)</label>
                <input type="number" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{display:'block',marginBottom:'6px',fontSize:'14px',fontWeight:'500'}}>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',boxSizing:'border-box'}} placeholder="Optional description" />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button type="button" onClick={handleCancel} style={{padding:'10px 20px',background:'#f0f2f5',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>Cancel</button>
              <button type="submit" style={{padding:'10px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>{editProduct ? 'Update Product' : 'Add Product'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{background:'white',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f8f9fa'}}>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Product</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Category</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Price</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Stock</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Status</th>
              <th style={{textAlign:'left',padding:'12px',fontSize:'13px',color:'#666'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0
              ? <tr><td colSpan="6" style={{textAlign:'center',padding:'40px',color:'#999'}}>No products yet</td></tr>
              : products.map(product => (
                <tr key={product.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                  <td style={{padding:'12px'}}>
                    <p style={{margin:'0 0 2px',fontWeight:'500',fontSize:'14px'}}>{product.name}</p>
                    <p style={{margin:0,fontSize:'12px',color:'#999'}}>{product.description}</p>
                  </td>
                  <td style={{padding:'12px',fontSize:'14px'}}>{product.category||'-'}</td>
                  <td style={{padding:'12px',fontSize:'14px',fontWeight:'500'}}>GH{Number(product.price).toFixed(2)}</td>
                  <td style={{padding:'12px',fontSize:'14px'}}>
                    <span style={{color: product.stock_quantity <= product.low_stock_threshold ? '#e74c3c' : '#2ecc71', fontWeight:'500'}}>
                      {product.stock_quantity}
                      {product.stock_quantity <= product.low_stock_threshold && ' ⚠️'}
                    </span>
                  </td>
                  <td style={{padding:'12px'}}>
                    <span style={{padding:'3px 10px',borderRadius:'20px',color:'white',fontSize:'12px',background: product.stock_quantity > 0 ? '#2ecc71' : '#e74c3c'}}>
                      {product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td style={{padding:'12px',display:'flex',gap:'4px'}}>
                    <button onClick={() => handleEdit(product)} style={{padding:'4px 12px',background:'#3498db',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Edit</button>
                    <button onClick={() => handleDelete(product.id)} style={{padding:'4px 12px',background:'#e74c3c',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px'}}>Delete</button>
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

export default Products;