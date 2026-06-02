import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

const reportsAPI = {
  getRevenue: (params) => API.get('/reports/revenue', { params }),
  getProducts: (params) => API.get('/reports/products', { params }),
  getRiders: (params) => API.get('/reports/riders', { params }),
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [products, setProducts] = useState(null);
  const [riders, setRiders] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [revRes, prodRes, riderRes] = await Promise.all([
        reportsAPI.getRevenue({ period }),
        reportsAPI.getProducts({ period }),
        reportsAPI.getRiders({ period }),
      ]);
      setRevenue(revRes.data);
      setProducts(prodRes.data);
      setRiders(riderRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { key: 'revenue', label: '💰 Revenue' },
    { key: 'products', label: '📦 Products' },
    { key: 'riders', label: '🏍️ Riders' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>Business analytics and performance</p>
        </div>
        <select
          className="form-input"
          style={{ width: 'auto' }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === tab.key ? '600' : '400',
              color: activeTab === tab.key ? '#1a1a2e' : '#888',
              borderBottom: activeTab === tab.key ? '2px solid #1a1a2e' : '2px solid transparent',
              marginBottom: '-2px', whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading reports...</div>
      ) : (
        <>
          {/* Revenue Tab */}
          {activeTab === 'revenue' && revenue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Summary cards */}
              <div className="stats-grid">
                <div className="card" style={{ borderTop: '4px solid #2ecc71' }}>
                  <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Total Revenue</p>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#2ecc71', margin: 0 }}>
                    GH₵ {parseFloat(revenue.summary?.total_revenue || 0).toFixed(2)}
                  </h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Last {period} days</p>
                </div>
                <div className="card" style={{ borderTop: '4px solid #3498db' }}>
                  <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Total Orders</p>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#3498db', margin: 0 }}>
                    {revenue.summary?.total_orders || 0}
                  </h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>{revenue.summary?.delivered || 0} delivered</p>
                </div>
                <div className="card" style={{ borderTop: '4px solid #9b59b6' }}>
                  <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Avg Order Value</p>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#9b59b6', margin: 0 }}>
                    GH₵ {parseFloat(revenue.summary?.avg_order_value || 0).toFixed(2)}
                  </h3>
                </div>
                <div className="card" style={{ borderTop: '4px solid #e74c3c' }}>
                  <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Failed Orders</p>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#e74c3c', margin: 0 }}>
                    {revenue.summary?.failed || 0}
                  </h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>{revenue.summary?.returned || 0} returned</p>
                </div>
              </div>

              {/* Payment breakdown */}
              {revenue.payment_breakdown?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Payment Methods</h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {revenue.payment_breakdown.map(p => (
                      <div key={p.payment_method} style={{
                        flex: 1, minWidth: '140px', padding: '16px',
                        background: '#f8f9fa', borderRadius: '8px', textAlign: 'center',
                      }}>
                        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: '600' }}>{p.payment_method}</p>
                        <p style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{p.count}</p>
                        <p style={{ color: '#2ecc71', fontWeight: '700', margin: 0 }}>GH₵ {parseFloat(p.total || 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily breakdown */}
              {revenue.daily?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Daily Breakdown</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Orders</th>
                          <th>Delivered</th>
                          <th>Failed</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenue.daily.map((d, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '500' }}>
                              {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td>{d.total_orders}</td>
                            <td style={{ color: '#2ecc71', fontWeight: '600' }}>{d.delivered}</td>
                            <td style={{ color: '#e74c3c', fontWeight: '600' }}>{d.failed}</td>
                            <td style={{ fontWeight: '700', color: '#2ecc71' }}>GH₵ {parseFloat(d.revenue || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && products && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Top selling */}
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Top Selling Products</h3>
                {products.top_products?.length === 0 ? (
                  <div className="empty-state">
                    <h3>No sales data yet</h3>
                    <p>Sales will appear here once orders are delivered</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Units Sold</th>
                          <th>Revenue</th>
                          <th>Current Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.top_products?.map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '600' }}>{p.name}</td>
                            <td style={{ color: '#666' }}>{p.category || '—'}</td>
                            <td style={{ fontWeight: '600' }}>{p.total_sold}</td>
                            <td style={{ fontWeight: '700', color: '#2ecc71' }}>GH₵ {parseFloat(p.total_revenue || 0).toFixed(2)}</td>
                            <td>
                              <span style={{
                                background: p.current_stock === 0 ? '#f8d7da' : p.current_stock <= 5 ? '#fff3cd' : '#d4edda',
                                color: p.current_stock === 0 ? '#721c24' : p.current_stock <= 5 ? '#856404' : '#155724',
                                padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                              }}>
                                {p.current_stock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Low stock */}
              {products.low_stock?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>⚠️ Low Stock Alert</h3>
                  <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>{products.low_stock.length} products need restocking</p>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Current Stock</th>
                          <th>Threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.low_stock.map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '600' }}>{p.name}</td>
                            <td style={{ color: '#666' }}>{p.category || '—'}</td>
                            <td style={{ color: p.stock_quantity === 0 ? '#e74c3c' : '#f39c12', fontWeight: '700' }}>{p.stock_quantity}</td>
                            <td style={{ color: '#888' }}>{p.low_stock_threshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Riders Tab */}
          {activeTab === 'riders' && riders && (
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Rider Performance</h3>
              {riders.riders?.length === 0 ? (
                <div className="empty-state">
                  <h3>No riders yet</h3>
                  <p>Add riders to see their performance</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Rider</th>
                        <th>Deliveries</th>
                        <th>Successful</th>
                        <th>Failed</th>
                        <th>Success Rate</th>
                        <th>Cash Collected</th>
                        <th>Disputes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riders.riders?.map((r, i) => {
                        const rate = r.total_deliveries > 0
                          ? ((r.successful / r.total_deliveries) * 100).toFixed(0)
                          : 0;
                        return (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{r.rider_name}</div>
                              <div style={{ fontSize: '11px', color: '#888' }}>{r.phone}</div>
                            </td>
                            <td style={{ fontWeight: '600' }}>{r.total_deliveries}</td>
                            <td style={{ color: '#2ecc71', fontWeight: '600' }}>{r.successful}</td>
                            <td style={{ color: '#e74c3c', fontWeight: '600' }}>{r.failed}</td>
                            <td>
                              <span style={{
                                background: rate >= 80 ? '#d4edda' : rate >= 60 ? '#fff3cd' : '#f8d7da',
                                color: rate >= 80 ? '#155724' : rate >= 60 ? '#856404' : '#721c24',
                                padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                              }}>
                                {rate}%
                              </span>
                            </td>
                            <td style={{ fontWeight: '700', color: '#2ecc71' }}>GH₵ {parseFloat(r.total_cash_collected || 0).toFixed(2)}</td>
                            <td style={{ color: r.disputed_collections > 0 ? '#e74c3c' : '#888', fontWeight: r.disputed_collections > 0 ? '700' : '400' }}>
                              {r.disputed_collections}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
