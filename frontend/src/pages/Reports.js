import React, { useState, useEffect, useCallback } from 'react';
import API, { productsAPI } from '../utils/api';

const reportsAPI = {
  getRevenue:  (params) => API.get('/reports/revenue',  { params }),
  getProducts: (params) => API.get('/reports/products', { params }),
  getRiders:   (params) => API.get('/reports/riders',   { params }),
};

/* ─── CSV helper ──────────────────────────────────────────────── */
const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ─── Inline SVG bar chart ────────────────────────────────────── */
const BarChart = ({ data }) => {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => parseFloat(d.revenue || 0)), 1);
  const W = 600, H = 180, PAD = 40;
  const barW = Math.max(6, Math.floor((W - PAD * 2) / data.length) - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD + H - frac * H;
        return (
          <g key={frac}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {(frac * maxVal / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const val   = parseFloat(d.revenue || 0);
        const barH  = (val / maxVal) * H;
        const x     = PAD + i * ((W - PAD * 2) / data.length) + 2;
        const y     = PAD + H - barH;
        const isMax = val === Math.max(...data.map(dd => parseFloat(dd.revenue || 0)));
        const isMin = val === Math.min(...data.map(dd => parseFloat(dd.revenue || 0)));
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={barH} rx="3"
              fill={isMax ? '#22c55e' : isMin ? '#ef4444' : '#3b82f6'}
              opacity="0.85"
            />
            {data.length <= 14 && (
              <text x={x + barW / 2} y={H + PAD + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const Reports = () => {
  const [activeTab,   setActiveTab]   = useState('revenue');
  const [period,      setPeriod]      = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [revenue,     setRevenue]     = useState(null);
  const [products,    setProducts]    = useState(null);
  const [riders,      setRiders]      = useState(null);
  const [restocked,   setRestocked]   = useState(new Set());

  /* ── Build API params ────────────────────────────────────────── */
  const buildParams = useCallback(() => {
    if (period === 'custom' && customStart && customEnd) {
      return { start_date: customStart, end_date: customEnd };
    }
    return { period };
  }, [period, customStart, customEnd]);

  /* ── Fetch all report data ───────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (period === 'custom' && (!customStart || !customEnd)) return;
    try {
      setLoading(true);
      const params = buildParams();
      const [revRes, prodRes, riderRes] = await Promise.all([
        reportsAPI.getRevenue(params),
        reportsAPI.getProducts(params),
        reportsAPI.getRiders(params),
      ]);
      setRevenue(revRes.data);
      setProducts(prodRes.data);
      setRiders(riderRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Mark restocked ──────────────────────────────────────────── */
  const handleRestock = async (productId) => {
    try {
      await productsAPI.updateStock(productId, { stock_quantity: 999, action: 'set' });
      setRestocked(s => new Set(s).add(productId));
    } catch {
      alert('Error updating stock');
    }
  };

  /* ── CSV exports ─────────────────────────────────────────────── */
  const exportRevenueCSV = () => {
    if (!revenue?.daily?.length) return;
    downloadCSV(
      revenue.daily.map(d => ({
        Date:              d.date,
        Orders:            d.total_orders,
        Delivered:         d.delivered,
        Failed:            d.failed,
        'Revenue (GH₵)':  parseFloat(d.revenue || 0).toFixed(2),
      })),
      `revenue-report-${period === 'custom' ? `${customStart}-${customEnd}` : `${period}d`}.csv`
    );
  };

  const exportProductsCSV = () => {
    if (!products?.top_products?.length) return;
    downloadCSV(
      products.top_products.map(p => ({
        Product:           p.name,
        Category:          p.category || '',
        'Units Sold':      p.total_sold,
        'Revenue (GH₵)':  parseFloat(p.total_revenue || 0).toFixed(2),
        Stock:             p.current_stock,
      })),
      `products-report.csv`
    );
  };

  const exportRidersCSV = () => {
    if (!riders?.riders?.length) return;
    downloadCSV(
      riders.riders.map(r => ({
        Rider:                  r.rider_name,
        Phone:                  r.phone,
        Deliveries:             r.total_deliveries,
        Successful:             r.successful,
        Failed:                 r.failed,
        'Success Rate':         r.total_deliveries > 0 ? `${((r.successful / r.total_deliveries) * 100).toFixed(0)}%` : '0%',
        'Cash Collected (GH₵)': parseFloat(r.total_cash_collected || 0).toFixed(2),
        Disputes:               r.disputed_collections,
      })),
      `riders-report.csv`
    );
  };

  /* ── Best / worst day ────────────────────────────────────────── */
  const maxRevDay = revenue?.daily?.length ? Math.max(...revenue.daily.map(d => parseFloat(d.revenue || 0))) : null;
  const minRevDay = revenue?.daily?.length ? Math.min(...revenue.daily.map(d => parseFloat(d.revenue || 0))) : null;

  /* ── Period label ────────────────────────────────────────────── */
  const periodLabel = period === 'custom'
    ? `${customStart} → ${customEnd}`
    : `Last ${period} days`;

  const tabs = [
    { key: 'revenue',  label: '💰 Revenue' },
    { key: 'products', label: '📦 Products' },
    { key: 'riders',   label: '🏍️ Riders' },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business analytics and performance</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={period}
            onChange={e => { setPeriod(e.target.value); setCustomStart(''); setCustomEnd(''); }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span style={{ color: 'var(--text-3)' }}>→</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Loading reports…</span>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════
              TAB: Revenue
          ══════════════════════════════════════════ */}
          {activeTab === 'revenue' && revenue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Summary cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon">💰</span>
                  <p className="stat-label">Total Revenue</p>
                  <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>
                    GH₵ {parseFloat(revenue.summary?.total_revenue || 0).toFixed(2)}
                  </p>
                  <p className="stat-sub">{periodLabel}</p>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">📦</span>
                  <p className="stat-label">Total Orders</p>
                  <p className="stat-value" style={{ color: '#3b82f6' }}>
                    {revenue.summary?.total_orders || 0}
                  </p>
                  <p className="stat-sub">{revenue.summary?.delivered || 0} delivered</p>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">📈</span>
                  <p className="stat-label">Avg Order Value</p>
                  <p className="stat-value" style={{ color: '#8b5cf6' }}>
                    GH₵ {parseFloat(revenue.summary?.avg_order_value || 0).toFixed(2)}
                  </p>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">❌</span>
                  <p className="stat-label">Failed Orders</p>
                  <p className="stat-value" style={{ color: '#ef4444' }}>
                    {revenue.summary?.failed || 0}
                  </p>
                  <p className="stat-sub">{revenue.summary?.returned || 0} returned</p>
                </div>
              </div>

              {/* Payment methods */}
              {revenue.payment_breakdown?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Payment Methods</h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {revenue.payment_breakdown.map(p => (
                      <div key={p.payment_method} style={{
                        flex: 1, minWidth: '130px', padding: '16px',
                        background: '#f8fafc', borderRadius: '10px', textAlign: 'center',
                      }}>
                        <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.05em' }}>
                          {p.payment_method === 'momo' ? 'MTN MoMo' : p.payment_method === 'cod' ? 'Cash on Delivery' : p.payment_method}
                        </p>
                        <p style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 4px' }}>
                          {p.count} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)' }}>orders</span>
                        </p>
                        <p style={{ color: 'var(--accent, #22c55e)', fontWeight: '700', margin: 0 }}>
                          GH₵ {parseFloat(p.total || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bar chart + daily table */}
              {revenue.daily?.length > 0 && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Daily Revenue</h3>
                    <button className="btn btn-secondary btn-sm" onClick={exportRevenueCSV}>⬇ Download CSV</button>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <BarChart data={revenue.daily} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: 'var(--text-3)' }}>
                      <span><span style={{ color: '#22c55e' }}>■</span> Best day</span>
                      <span><span style={{ color: '#ef4444' }}>■</span> Worst day</span>
                      <span><span style={{ color: '#3b82f6' }}>■</span> Normal</span>
                    </div>
                  </div>

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
                        {revenue.daily.map((d, i) => {
                          const rev    = parseFloat(d.revenue || 0);
                          const isBest  = rev === maxRevDay;
                          const isWorst = rev === minRevDay;
                          return (
                            <tr key={i} style={{ background: isBest ? '#f0fdf4' : isWorst ? '#fef2f2' : undefined }}>
                              <td style={{ fontWeight: '500' }}>
                                {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                {isBest  && <span className="badge badge-green" style={{ marginLeft: '8px' }}>Best</span>}
                                {isWorst && <span className="badge badge-red"   style={{ marginLeft: '8px' }}>Worst</span>}
                              </td>
                              <td>{d.total_orders}</td>
                              <td style={{ color: 'var(--accent, #22c55e)', fontWeight: '600' }}>{d.delivered}</td>
                              <td style={{ color: '#ef4444', fontWeight: '600' }}>{d.failed}</td>
                              <td style={{ fontWeight: '700', color: isBest ? '#22c55e' : isWorst ? '#ef4444' : 'inherit' }}>
                                GH₵ {rev.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: Products
          ══════════════════════════════════════════ */}
          {activeTab === 'products' && products && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Top Selling Products</h3>
                  <button className="btn btn-secondary btn-sm" onClick={exportProductsCSV}>⬇ Download CSV</button>
                </div>
                {!products.top_products?.length ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
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
                        {products.top_products.map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '600' }}>{p.name}</td>
                            <td style={{ color: 'var(--text-2)' }}>{p.category || '—'}</td>
                            <td style={{ fontWeight: '600' }}>{p.total_sold}</td>
                            <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                              GH₵ {parseFloat(p.total_revenue || 0).toFixed(2)}
                            </td>
                            <td>
                              <span className={`badge ${p.current_stock === 0 ? 'badge-red' : p.current_stock <= 5 ? 'badge-amber' : 'badge-green'}`}>
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

              {/* Low stock alert */}
              {products.low_stock?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>⚠️ Low Stock Alert</h3>
                  <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                    {products.low_stock.length} products need restocking
                  </p>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Current Stock</th>
                          <th>Threshold</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.low_stock.map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '600' }}>{p.name}</td>
                            <td style={{ color: 'var(--text-2)' }}>{p.category || '—'}</td>
                            <td>
                              <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : 'badge-amber'}`}>
                                {p.stock_quantity}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-3)' }}>{p.low_stock_threshold}</td>
                            <td>
                              {restocked.has(p.id) ? (
                                <span className="badge badge-green">✓ Restocked</span>
                              ) : (
                                <button className="btn btn-success btn-sm" onClick={() => handleRestock(p.id)}>
                                  Mark Restocked
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: Riders
          ══════════════════════════════════════════ */}
          {activeTab === 'riders' && riders && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Rider Performance</h3>
                <button className="btn btn-secondary btn-sm" onClick={exportRidersCSV}>⬇ Download CSV</button>
              </div>
              {!riders.riders?.length ? (
                <div className="empty-state">
                  <div className="empty-icon">🏍️</div>
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
                        <th>Resolved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riders.riders.map((r, i) => {
                        const rate = r.total_deliveries > 0
                          ? ((r.successful / r.total_deliveries) * 100).toFixed(0)
                          : 0;
                        return (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{r.rider_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.phone}</div>
                            </td>
                            <td style={{ fontWeight: '600' }}>{r.total_deliveries}</td>
                            <td style={{ color: 'var(--accent, #22c55e)', fontWeight: '600' }}>{r.successful}</td>
                            <td style={{ color: '#ef4444', fontWeight: '600' }}>{r.failed}</td>
                            <td>
                              <span className={`badge ${rate >= 80 ? 'badge-green' : rate >= 60 ? 'badge-amber' : 'badge-red'}`}>
                                {rate}%
                              </span>
                            </td>
                            <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                              GH₵ {parseFloat(r.total_cash_collected || 0).toFixed(2)}
                            </td>
                            <td style={{
                              color: r.disputed_collections > 0 ? '#ef4444' : 'var(--text-3)',
                              fontWeight: r.disputed_collections > 0 ? '700' : '400',
                            }}>
                              {r.disputed_collections}
                            </td>
                            <td style={{ color: '#1d4ed8', fontWeight: r.resolved_collections > 0 ? '700' : '400' }}>
                              {r.resolved_collections || 0}
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
