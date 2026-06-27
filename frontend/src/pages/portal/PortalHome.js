import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../../utils/api';

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

export default function PortalHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rider, setRider] = useState(null);
  const [stats, setStats] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [cashLogs, setCashLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ridersRes = await ridersAPI.getAll({ limit: 200 });
      const myRider = (ridersRes.data.riders || []).find(r => String(r.user_id) === String(user?.id));
      setRider(myRider || null);
      if (myRider) {
        const today = new Date().toISOString().split('T')[0];
        const [delRes, statsRes, cashRes] = await Promise.all([
          API.get(`/riders/${myRider.id}/deliveries?date=${today}`),
          API.get(`/riders/${myRider.id}/stats`),
          API.get(`/cash?rider_id=${myRider.id}&limit=3`),
        ]);
        setDeliveries(delRes.data.deliveries || []);
        setStats(statsRes.data.stats || null);
        setCashLogs(cashRes.data.logs || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading…</span></div>;

  if (!rider) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏍️</div>
      <h3 style={{ color: '#1a1a18', margin: '0 0 8px' }}>No rider profile found</h3>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Ask your admin to link your account to a rider profile.</p>
    </div>
  );

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const active = deliveries.filter(d => !['delivered', 'failed', 'returned', 'damaged'].includes(d.status));
  const delivered = deliveries.filter(d => d.status === 'delivered');
  const pendingCash = cashLogs.filter(l => l.status === 'pending');
  const pendingAmount = pendingCash.reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  const quickActions = [
    { icon: '📦', label: 'My Deliveries', sub: `${active.length} active`, path: '/portal/deliveries', color: '#1d4ed8', bg: '#eff6ff' },
    { icon: '💰', label: 'Cash & Payments', sub: pendingAmount > 0 ? `${fmt(pendingAmount)} pending` : 'All clear', path: '/portal/cash', color: pendingAmount > 0 ? '#c2410c' : '#16a34a', bg: pendingAmount > 0 ? '#fff7ed' : '#f0fdf4' },
    { icon: '💬', label: 'Messages', sub: 'Chat with team', path: '/portal/messages', color: '#7c3aed', bg: '#f5f3ff' },
    { icon: '👤', label: 'My Profile', sub: rider.zone || 'View details', path: '/portal/profile', color: '#0f766e', bg: '#f0fdfa' },
  ];

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', margin: 0 }}>
          Hey, {rider.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>{today}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: "Today's Jobs", value: deliveries.length, icon: '📦', color: '#1d4ed8' },
          { label: 'Delivered', value: delivered.length, icon: '✅', color: '#16a34a' },
          { label: 'Active Now', value: active.length, icon: '⏳', color: '#d97706' },
          { label: 'Success Rate', value: `${stats?.success_rate || 0}%`, icon: '📈', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending cash alert */}
      {pendingAmount > 0 && (
        <div onClick={() => navigate('/portal/cash')} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 16px', marginBottom: 20, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#c2410c', fontSize: 14 }}>💰 Cash Pending Verification</div>
            <div style={{ fontSize: 13, color: '#9a3412', marginTop: 2 }}>{fmt(pendingAmount)} to hand over to admin</div>
          </div>
          <span style={{ fontSize: 18, color: '#c2410c' }}>→</span>
        </div>
      )}

      {/* Quick actions */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', margin: '0 0 12px' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {quickActions.map(action => (
          <div key={action.path} onClick={() => navigate(action.path)} style={{ background: action.bg, borderRadius: 14, padding: '16px', cursor: 'pointer', border: `1px solid ${action.color}20` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{action.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{action.label}</div>
            <div style={{ fontSize: 12, color: action.color, fontWeight: 600, marginTop: 2 }}>{action.sub}</div>
          </div>
        ))}
      </div>

      {/* Active deliveries preview */}
      {active.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Active Deliveries</h2>
            <button onClick={() => navigate('/portal/deliveries')} style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.slice(0, 3).map(d => (
              <div key={d.id} onClick={() => navigate('/portal/deliveries')} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{d.order_number}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginTop: 2 }}>{d.customer_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>📍 {d.delivery_address || d.customer_address || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{fmt(d.total_amount)}</div>
                  <div style={{ fontSize: 11, color: d.payment_method === 'cod' ? '#dc2626' : '#16a34a', fontWeight: 600, marginTop: 2 }}>
                    {d.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Earnings summary */}
      {stats && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a18, #374151)', borderRadius: 16, padding: '20px', marginTop: 20, color: '#fff' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px', color: '#22c55e' }}>{fmt(stats.month_earnings)}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{stats.total_delivered} deliveries completed · {stats.success_rate}% success rate</p>
        </div>
      )}
    </div>
  );
}
