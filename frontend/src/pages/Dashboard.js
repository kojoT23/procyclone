import React, { useState, useEffect } from 'react';
import { ordersAPI, productsAPI, ridersAPI } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({ orders: 0, products: 0, riders: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [orders, products, riders] = await Promise.all([
        ordersAPI.getAll(),
        productsAPI.getAll(),
        ridersAPI.getAll(),
      ]);
      setStats({
        orders: orders.data.count,
        products: products.data.count,
        riders: riders.data.count,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>Loading...</div>;

  return (
    <div style={{padding:'24px'}}>
      <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#1a1a2e',marginBottom:'24px'}}>Overview</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'16px'}}>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',borderTop:'4px solid #3498db'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Total Orders</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>{stats.orders}</h3>
        </div>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',borderTop:'4px solid #2ecc71'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Products</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>{stats.products}</h3>
        </div>
        <div style={{background:'white',padding:'20px',borderRadius:'10px',borderTop:'4px solid #9b59b6'}}>
          <p style={{color:'#666',fontSize:'13px',margin:'0 0 4px'}}>Riders</p>
          <h3 style={{fontSize:'24px',fontWeight:'bold',margin:0}}>{stats.riders}</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;