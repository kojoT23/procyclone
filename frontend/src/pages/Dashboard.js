import React, { useState, useEffect } from 'react';
import { ordersAPI, productsAPI, ridersAPI, cashAPI } from '../utils/api';

const StatCard = ({ title, value, icon, color, sub }) => (
  <div className="card" style={{ borderTop: `4px solid ${color}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{title}</p>
      <span style={{ fontSize: '22px' }}>{icon}</span>
    </div>
    <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>{value}</h3>
    {sub && <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>{sub}</p>}
  </div>
);

const OrderRow = ({ order }) => {
  const statusColors = {
    pending: '#fff3cd', confirmed: '#cce5ff', packing: '#d4edda',
    assigned: '#e2d9f3', out_for_delivery: '#ffd6a5',
    delivered: '#d4edda', failed: '#f8d7da', returned: '#e2e3e5',
  };
  const statusText = {
    pending: '#856404', confirmed: '#004085', packing: '#155724',
    assigned: '#4a235a', out_for_delivery: '#7d4e00',
    delivered: '#155724', failed: '#721c24', returned: '#383d41',
  };

  return (
    <tr>
      <td style={{ fontWeight: '600', color: '#1a1a2e' }}>{order.order_number}</td>
      <td>{order.customer_name || '—'}</td>
      <td>
        <span style={{
          background: statusColors[order.status] || '#eee',
          color: statusText[order.status] || '#333',
          padding: '3px 10px', borderRadius: '20px',
          fontSize: '11px', fontWeight: '600', textTransform: 'capitalize',
        }}>
          {order.status?.replace('_', ' ')}
        </span>
      </td>
      <td style={{ fontWeight: '600' }}>GH₵ {parseFloat(order.total_amount || 0).toFixed(2)}</td>
      <td style={{ color: '#888', fontSize: '12px' }}>
        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({ orders: 0, products: 0, riders: 0, revenue: 0, pending: 0, delivered: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [orders, products, riders] = await Promise.all([
        ordersAPI.getAll({ limit: 100 }),
        productsAPI.getAll({ limit: 1 }),
        ridersAPI.getAll({ limit: 1 }),
      ]);

      const allOrders = orders.data.orders || [];
      const revenue = allOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

      setStats({
        orders: orders.data.total || 0,
        products: products.data.total || 0,
        riders: riders.data.total || 0,
        revenue: revenue.toFixed(2),
        pending: allOrders.filter(o => o.status === 'pending').length,
        delivered: allOrders.filter(o => o.status === 'delivered').length,
      });

      setRecentOrders(allOrders.slice(0, 8));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="loading">
      <div>
        <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>⚡</div>
        <p>Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary" style={{ fontSize: '12px' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard title="Total Orders" value={stats.orders} icon="🛍️" color="#3498db" sub={`${stats.pending} pending`} />
        <StatCard title="Revenue" value={`GH₵ ${stats.revenue}`} icon="💰" color="#2ecc71" sub="From delivered orders" />
        <StatCard title="Products" value={stats.products} icon="📦" color="#9b59b6" sub="In inventory" />
        <StatCard title="Riders" value={stats.riders} icon="🏍️" color="#e67e22" sub={`${stats.delivered} delivered`} />
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Recent Orders</h2>
          <a href="/orders" style={{ fontSize: '13px', color: '#3498db', textDecoration: 'none' }}>View all →</a>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders yet</h3>
            <p>Orders will appear here once created</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
