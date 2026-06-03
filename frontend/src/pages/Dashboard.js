import React, { useState, useEffect } from 'react';
import { ordersAPI, productsAPI, ridersAPI } from '../utils/api';

const STATUS_COLORS = {
  pending:          { bg: '#fef3c7', text: '#d97706' },
  confirmed:        { bg: '#dbeafe', text: '#1d4ed8' },
  packing:          { bg: '#ede9fe', text: '#7c3aed' },
  assigned:         { bg: '#ccfbf1', text: '#0f766e' },
  out_for_delivery: { bg: '#fed7aa', text: '#c2410c' },
  delivered:        { bg: '#dcfce7', text: '#16a34a' },
  failed:           { bg: '#fee2e2', text: '#dc2626' },
  returned:         { bg: '#f1f5f9', text: '#475569' },
};

const StatCard = ({ label, value, sub, icon, color }) => (
  <div className="stat-card" style={{ '--accent-color': color }}>
    <div className="stat-icon">{icon}</div>
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
    {sub && <p className="stat-sub">{sub}</p>}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ orders: 0, products: 0, riders: 0, revenue: '0.00', pending: 0, delivered: 0 });
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
    } catch (err) {
      console.error(err);
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
    <div style={{ padding: '32px' }}>
      <div className="loading">
        <div className="loading-spinner" />
        <p className="loading-text">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: '1200px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary">↻ Refresh</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Orders" value={stats.orders} sub={`${stats.pending} pending`} icon="🛍️" color="#3b82f6" />
        <StatCard label="Revenue" value={`GH₵ ${stats.revenue}`} sub="From delivered orders" icon="💰" color="#22c55e" />
        <StatCard label="Products" value={stats.products} sub="In inventory" icon="📦" color="#8b5cf6" />
        <StatCard label="Riders" value={stats.riders} sub={`${stats.delivered} delivered`} icon="🏍️" color="#f59e0b" />
      </div>

      <div className="card">
        <div className="card-header">
          <p className="card-title">Recent Orders</p>
          <a href="/orders" style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '600' }}>View all →</a>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h3>No orders yet</h3>
            <p>Orders will appear here once created</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: 'var(--navy)' }}>
                        {order.order_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{order.customer_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{order.customer_phone}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: STATUS_COLORS[order.status]?.bg, color: STATUS_COLORS[order.status]?.text }}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: 'var(--accent-dim)' }}>
                        GH₵ {parseFloat(order.total_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                      {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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

export default Dashboard;
