import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI, productsAPI, ridersAPI, cashAPI } from '../utils/api';


/* ─── Helpers ─────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0];

const fmt = (n) => parseFloat(n || 0).toFixed(2);

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const Delta = ({ value, prev }) => {
  if (prev == null || (prev === 0 && value === 0)) return null;
  const pct = prev === 0 ? 100 : ((value - prev) / prev) * 100;
  const up  = pct >= 0;
  return (
    <span style={{
      fontSize: '11px', fontWeight: '700',
      color: up ? '#15803d' : '#dc2626',
      background: up ? '#dcfce7' : '#fee2e2',
      padding: '2px 7px', borderRadius: '20px',
      marginLeft: '8px', whiteSpace: 'nowrap',
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
};

/* ─── Pipeline stage ──────────────────────────────────────────── */
const PIPELINE = [
  { key: 'pending',          label: 'Pending',       color: '#f59e0b', bg: '#fffbeb' },
  { key: 'confirmed',        label: 'Confirmed',     color: '#3b82f6', bg: '#eff6ff' },
  { key: 'packing',          label: 'Packing',       color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'assigned',         label: 'Assigned',      color: '#14b8a6', bg: '#f0fdfa' },
  { key: 'out_for_delivery', label: 'Out',           color: '#f97316', bg: '#fff7ed' },
  { key: 'delivered',        label: 'Delivered',     color: '#22c55e', bg: '#f0fdf4' },
  { key: 'failed',           label: 'Failed',        color: '#ef4444', bg: '#fef2f2' },
];

/* ═══════════════════════════════════════════════════════════════
   Dashboard
═══════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const navigate  = useNavigate();

  /* ── State ─────────────────────────────────────────────────── */
  const [loading,       setLoading]       = useState(true);
  const [lastRefresh,   setLastRefresh]   = useState(null);

  /* Today's data */
  const [todayOrders,   setTodayOrders]   = useState([]);
  const [todayRevenue,  setTodayRevenue]  = useState(0);
  const [todayCash,     setTodayCash]     = useState(0);
  const [pipeline,      setPipeline]      = useState({});

  /* Yesterday (for delta) */
  const [yestRevenue,   setYestRevenue]   = useState(0);
  const [yestOrders,    setYestOrders]    = useState(0);

  /* Riders */
  const [riders,        setRiders]        = useState([]);

  /* Alerts */
  const [lowStock,      setLowStock]      = useState([]);
  const [disputes,      setDisputes]      = useState(0);
  const [pendingCash,   setPendingCash]   = useState(0);

  /* Recent orders */
  const [recentOrders,  setRecentOrders]  = useState([]);

  /* Totals */
  const [totalProducts, setTotalProducts] = useState(0);

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const todayStr = today();

      /* Yesterday string */
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];

      const [
        todayOrdersRes,
        yestOrdersRes,
        ridersRes,
        productsRes,
        cashRes,
        lowStockRes,
      ] = await Promise.all([
        ordersAPI.getAll({ limit: 100, start_date: todayStr, end_date: todayStr }),
        ordersAPI.getAll({ limit: 100, start_date: yestStr,  end_date: yestStr  }),
        ridersAPI.getAll({ limit: 100 }),
        productsAPI.getAll({ limit: 1 }),
        cashAPI.getAll({ limit: 100, date: todayStr }),
        productsAPI.getAll({ limit: 20, low_stock: true }),
      ]);

      /* Today's orders */
      const tOrders = todayOrdersRes.data.orders || [];
      setTodayOrders(tOrders);
      setRecentOrders(tOrders.slice(0, 8));

      /* Today revenue */
      const tRev = tOrders
        .filter(o => o.status === 'delivered')
        .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      setTodayRevenue(tRev);

      /* Pipeline counts */
      const pipe = {};
      tOrders.forEach(o => { pipe[o.status] = (pipe[o.status] || 0) + 1; });
      setPipeline(pipe);

      /* Yesterday */
      const yOrders = yestOrdersRes.data.orders || [];
      setYestOrders(yOrders.length);
      setYestRevenue(
        yOrders
          .filter(o => o.status === 'delivered')
          .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
      );

      /* Riders */
      setRiders(ridersRes.data.riders || []);

      /* Products */
      setTotalProducts(productsRes.data.total || 0);

      /* Cash */
      const cashLogs = cashRes.data.logs || [];
      const tCash = cashLogs
        .filter(c => c.status === 'verified')
        .reduce((s, c) => s + parseFloat(c.amount || 0), 0);
      setTodayCash(tCash);
      setDisputes(cashLogs.filter(c => c.status === 'disputed').length);
      setPendingCash(cashLogs.filter(c => c.status === 'pending').length);

      /* Low stock */
      const lsProducts = (lowStockRes.data.products || []).filter(
        p => p.stock_quantity <= p.low_stock_threshold
      );
      setLowStock(lsProducts.slice(0, 5));

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ── Derived ───────────────────────────────────────────────── */
  const availableRiders = riders.filter(r => r.is_available);
  const busyRiders      = riders.filter(r => !r.is_available);
  const totalAlerts     = disputes + (lowStock.length > 0 ? 1 : 0) + (pendingCash > 0 ? 1 : 0);
  const outForDelivery  = pipeline['out_for_delivery'] || 0;

  /* ── Loading ───────────────────────────────────────────────── */
  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading dashboard…</span>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'} 👋</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
            {lastRefresh && (
              <span style={{ marginLeft: '10px', color: 'var(--text-3)', fontSize: '12px' }}>
                · Updated {timeAgo(lastRefresh)}
              </span>
            )}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Alert strip ─────────────────────────────────────── */}
      {totalAlerts > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {disputes > 0 && (
            <div
              className="alert alert-danger"
              style={{ flex: 1, minWidth: '200px', cursor: 'pointer', margin: 0 }}
              onClick={() => navigate('/cash')}
            >
              ⚠️ <strong>{disputes} cash dispute{disputes > 1 ? 's' : ''}</strong> need attention
              <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>View →</span>
            </div>
          )}
          {pendingCash > 0 && (
            <div
              className="alert alert-warning"
              style={{ flex: 1, minWidth: '200px', cursor: 'pointer', margin: 0 }}
              onClick={() => navigate('/cash')}
            >
              🕐 <strong>{pendingCash} pending cash log{pendingCash > 1 ? 's' : ''}</strong> to verify
              <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>View →</span>
            </div>
          )}
          {lowStock.length > 0 && (
            <div
              className="alert alert-warning"
              style={{ flex: 1, minWidth: '200px', cursor: 'pointer', margin: 0 }}
              onClick={() => navigate('/inventory')}
            >
              📦 <strong>{lowStock.length} product{lowStock.length > 1 ? 's' : ''} low on stock</strong>
              <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>View →</span>
            </div>
          )}
        </div>
      )}

      {/* ── Summary stat cards ──────────────────────────────── */}
      <div className="stats-grid">

        {/* Today's Orders */}
        <div
          className="stat-card"
          style={{ '--accent-color': '#3b82f6', cursor: 'pointer' }}
          onClick={() => navigate('/orders')}
        >
          <div className="stat-icon">⊡</div>
          <p className="stat-label">Today's Orders</p>
          <p className="stat-value" style={{ color: '#3b82f6' }}>
            {todayOrders.length}
            <Delta value={todayOrders.length} prev={yestOrders} />
          </p>
          <p className="stat-sub">
            {pipeline['out_for_delivery'] || 0} out for delivery
          </p>
        </div>

        {/* Today's Revenue */}
        <div
          className="stat-card"
          style={{ '--accent-color': '#22c55e', cursor: 'pointer' }}
          onClick={() => navigate('/reports')}
        >
          <div className="stat-icon">💰</div>
          <p className="stat-label">Today's Revenue</p>
          <p className="stat-value" style={{ color: '#22c55e', fontSize: '22px' }}>
            GH₵ {fmt(todayRevenue)}
            <Delta value={todayRevenue} prev={yestRevenue} />
          </p>
          <p className="stat-sub">From delivered orders</p>
        </div>

        {/* Cash Collected */}
        <div
          className="stat-card"
          style={{ '--accent-color': '#8b5cf6', cursor: 'pointer' }}
          onClick={() => navigate('/cash')}
        >
          <div className="stat-icon">◈</div>
          <p className="stat-label">Cash Collected</p>
          <p className="stat-value" style={{ color: '#8b5cf6', fontSize: '22px' }}>
            GH₵ {fmt(todayCash)}
          </p>
          <p className="stat-sub">
            {pendingCash > 0
              ? <span style={{ color: '#f59e0b' }}>{pendingCash} pending verification</span>
              : 'All verified ✓'}
          </p>
        </div>

        {/* Riders */}
        <div
          className="stat-card"
          style={{ '--accent-color': '#f59e0b', cursor: 'pointer' }}
          onClick={() => navigate('/riders')}
        >
          <div className="stat-icon">⊕</div>
          <p className="stat-label">Riders</p>
          <p className="stat-value" style={{ color: '#f59e0b' }}>
            {riders.length}
          </p>
          <p className="stat-sub">
            <span style={{ color: '#22c55e', fontWeight: '600' }}>
              {availableRiders.length} available
            </span>
            {' · '}
            <span style={{ color: '#f97316' }}>
              {busyRiders.length} busy
            </span>
          </p>
        </div>

      </div>

      {/* ── Order pipeline ───────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <p className="card-title">Order Pipeline — Today</p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/orders')}
          >
            Manage orders →
          </button>
        </div>

        {todayOrders.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div className="empty-icon">⊡</div>
            <h3>No orders today yet</h3>
            <p>New orders will appear here automatically</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '10px',
          }}>
            {PIPELINE.map(stage => {
              const count = pipeline[stage.key] || 0;
              const pct   = todayOrders.length > 0
                ? Math.round((count / todayOrders.length) * 100)
                : 0;
              return (
                <div
                  key={stage.key}
                  onClick={() => navigate(`/orders?status=${stage.key}`)}
                  style={{
                    background: count > 0 ? stage.bg : '#fafafa',
                    border: `1px solid ${count > 0 ? stage.color + '30' : '#f0f0f0'}`,
                    borderRadius: '10px',
                    padding: '14px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    opacity: count === 0 ? 0.45 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <p style={{
                    fontSize: '26px', fontWeight: '800',
                    color: count > 0 ? stage.color : '#ccc',
                    margin: '0 0 4px', lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}
                  </p>
                  <p style={{
                    fontSize: '11px', fontWeight: '600',
                    color: count > 0 ? stage.color : '#aaa',
                    margin: '0 0 6px',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {stage.label}
                  </p>
                  {/* Mini progress bar */}
                  <div style={{
                    height: '3px', borderRadius: '10px',
                    background: '#e5e5e3', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '10px',
                      background: stage.color,
                      width: `${pct}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Riders + Low stock row ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Rider board */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <p className="card-title">Rider Status</p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/riders')}
            >
              Manage →
            </button>
          </div>

          {riders.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-icon">⊕</div>
              <h3>No riders yet</h3>
              <p>Add riders to track their status</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riders.slice(0, 6).map(rider => (
                <div
                  key={rider.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: rider.is_available ? '#f0fdf4' : '#fff7ed',
                    border: `1px solid ${rider.is_available ? '#bbf7d0' : '#fed7aa'}`,
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: rider.is_available ? '#22c55e' : '#f97316',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0,
                  }}>
                    {rider.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rider.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>
                      {rider.vehicle_type || 'Rider'}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: '700',
                    padding: '3px 8px', borderRadius: '20px',
                    background: rider.is_available ? '#dcfce7' : '#ffedd5',
                    color: rider.is_available ? '#15803d' : '#c2410c',
                    textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0,
                  }}>
                    {rider.is_available ? 'Available' : 'Busy'}
                  </span>
                </div>
              ))}
              {riders.length > 6 && (
                <p style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', margin: '4px 0 0' }}>
                  +{riders.length - 6} more riders
                </p>
              )}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <p className="card-title">
              Low Stock
              {lowStock.length > 0 && (
                <span className="badge badge-red" style={{ marginLeft: '8px' }}>
                  {lowStock.length}
                </span>
              )}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/inventory')}
            >
              View all →
            </button>
          </div>

          {lowStock.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-icon">📦</div>
              <h3>All stocked up</h3>
              <p>No products below their threshold</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowStock.map(p => {
                const pct = p.low_stock_threshold > 0
                  ? Math.min(100, (p.stock_quantity / p.low_stock_threshold) * 100)
                  : 0;
                const isOut = p.stock_quantity === 0;
                return (
                  <div key={p.id} style={{
                    padding: '10px 12px', borderRadius: '8px',
                    background: isOut ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isOut ? '#fecaca' : '#fde68a'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>
                        {p.name}
                      </p>
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        color: isOut ? '#dc2626' : '#b45309',
                      }}>
                        {p.stock_quantity} left
                      </span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '10px', background: '#e5e5e3', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '10px',
                        background: isOut ? '#ef4444' : '#f59e0b',
                        width: `${pct}%`,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Recent orders ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <p className="card-title">Recent Orders — Today</p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/orders')}
          >
            View all →
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⊡</div>
            <h3>No orders today yet</h3>
            <p>Orders placed today will appear here</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Rider</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/orders')}
                  >
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '12px',
                        fontWeight: '600', color: 'var(--navy)',
                      }}>
                        {order.order_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>
                        {order.customer_name || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                        {order.customer_phone}
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                      {order.rider_name || <span style={{ color: 'var(--text-3)' }}>Unassigned</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${order.status}`}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: 'var(--accent-dim)' }}>
                        GH₵ {fmt(order.total_amount)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {timeAgo(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom quick stats ───────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
      }}>
        {[
          { label: 'Total Products',    value: totalProducts,        color: '#8b5cf6', path: '/products' },
          { label: 'Total Riders',      value: riders.length,        color: '#f59e0b', path: '/riders'  },
          { label: 'Out for Delivery',  value: outForDelivery,       color: '#f97316', path: '/orders'  },
          { label: 'Cash Disputes',     value: disputes,             color: '#ef4444', path: '/cash'    },
        ].map(({ label, value, color, path }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderLeft: `3px solid ${color}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)' }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color, lineHeight: 1 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Dashboard;
