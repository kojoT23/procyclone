import React, { useState, useEffect, useCallback } from 'react';
import { cashAPI, ridersAPI } from '../utils/api';

const Cash = () => {
  const [logs, setLogs] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ rider_id: '', amount: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, ridersRes, reportRes] = await Promise.all([
        cashAPI.getAll({ limit: 50 }),
        ridersAPI.getAll({ limit: 100 }),
        cashAPI.getDailyReport(),
      ]);
      setLogs(logsRes.data.logs || []);
      setRiders(ridersRes.data.riders || []);
      setReport(reportRes.data.report || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async (id) => {
    try {
      await cashAPI.verify(id);
      fetchData();
    } catch (err) {
      alert('Error verifying cash log');
    }
  };

  const handleDispute = async (id) => {
    const notes = window.prompt('Reason for dispute:');
    if (!notes) return;
    try {
      await cashAPI.dispute(id, { notes });
      fetchData();
    } catch (err) {
      alert('Error disputing cash log');
    }
  };

  const handleSave = async () => {
    if (!form.rider_id || !form.amount) return alert('Rider and amount are required');
    try {
      setSaving(true);
      await cashAPI.create(form);
      setShowModal(false);
      setForm({ rider_id: '', amount: '', notes: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error logging cash');
    } finally {
      setSaving(false);
    }
  };

  const totalVerified = logs.filter(l => l.status === 'verified').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const totalPending = logs.filter(l => l.status === 'pending').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const totalDisputed = logs.filter(l => l.status === 'disputed').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

  const tabs = [
    { key: 'logs', label: '💰 Cash Logs' },
    { key: 'report', label: '📊 Daily Report' },
    { key: 'reconciliation', label: '⚖️ Reconciliation' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Control</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>Track and verify rider cash collections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Log Cash</button>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="card" style={{ borderTop: '4px solid #2ecc71' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Verified</p>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#2ecc71', margin: 0 }}>GH₵ {totalVerified.toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderTop: '4px solid #f39c12' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Pending</p>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#f39c12', margin: 0 }}>GH₵ {totalPending.toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderTop: '4px solid #e74c3c' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Disputed</p>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#e74c3c', margin: 0 }}>GH₵ {totalDisputed.toFixed(2)}</h3>
        </div>
        {report && (
          <div className="card" style={{ borderTop: '4px solid #3498db' }}>
            <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Today's Revenue</p>
            <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#3498db', margin: 0 }}>GH₵ {parseFloat(report.orders?.total_revenue || 0).toFixed(2)}</h3>
          </div>
        )}
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

      {/* Cash Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card">
          {loading ? (
            <div className="loading">Loading cash logs...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💰</div>
              <h3>No cash logs yet</h3>
              <p>Log rider cash collections here</p>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>+ Log Cash</button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{log.rider_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{log.rider_phone}</div>
                      </td>
                      <td style={{ fontWeight: '700', color: '#2ecc71', fontSize: '15px' }}>
                        GH₵ {parseFloat(log.amount || 0).toFixed(2)}
                      </td>
                      <td>
                        <span style={{
                          background: log.status === 'verified' ? '#d4edda' : log.status === 'disputed' ? '#f8d7da' : '#fff3cd',
                          color: log.status === 'verified' ? '#155724' : log.status === 'disputed' ? '#721c24' : '#856404',
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600', textTransform: 'capitalize',
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{log.notes || '—'}</td>
                      <td style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {log.status === 'pending' && (
                            <>
                              <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleVerify(log.id)}>✓ Verify</button>
                              <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleDispute(log.id)}>⚠ Dispute</button>
                            </>
                          )}
                          {log.status === 'verified' && <span style={{ color: '#2ecc71', fontSize: '12px' }}>✓ Verified</span>}
                          {log.status === 'disputed' && <span style={{ color: '#e74c3c', fontSize: '12px' }}>⚠ Disputed</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Daily Report Tab */}
      {activeTab === 'report' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Orders summary */}
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Orders Summary</h3>
                <div className="stats-grid">
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>Total Orders</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{report.orders?.total_orders || 0}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>Revenue</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#2ecc71', margin: 0 }}>GH₵ {parseFloat(report.orders?.total_revenue || 0).toFixed(2)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>Delivered</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#3498db', margin: 0 }}>{report.orders?.delivered || 0}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>Failed</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#e74c3c', margin: 0 }}>{report.orders?.failed || 0}</p>
                  </div>
                </div>
              </div>

              {/* Payment breakdown */}
              {report.payment_breakdown?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Payment Methods</h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {report.payment_breakdown.map(p => (
                      <div key={p.payment_method} style={{ flex: 1, minWidth: '120px', textAlign: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase' }}>{p.payment_method}</p>
                        <p style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 2px' }}>{p.count} orders</p>
                        <p style={{ color: '#2ecc71', fontWeight: '600', margin: 0 }}>GH₵ {parseFloat(p.total || 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rider performance */}
              {report.riders?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Rider Collections</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Rider</th>
                          <th>Collections</th>
                          <th>Total Amount</th>
                          <th>Verified</th>
                          <th>Pending</th>
                          <th>Disputed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.riders.map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '600' }}>{r.rider_name}</td>
                            <td>{r.total_collections || 0}</td>
                            <td style={{ fontWeight: '700', color: '#2ecc71' }}>GH₵ {parseFloat(r.total_amount || 0).toFixed(2)}</td>
                            <td style={{ color: '#2ecc71' }}>{r.verified || 0}</td>
                            <td style={{ color: '#f39c12' }}>{r.pending || 0}</td>
                            <td style={{ color: '#e74c3c' }}>{r.disputed || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === 'reconciliation' && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Rider Reconciliation</h3>
          <p style={{ color: '#888', fontSize: '13px' }}>
            Compare what each rider was expected to collect vs what they actually handed over.
            Select a rider from the Cash Logs tab to view their reconciliation.
          </p>
          <div style={{ marginTop: '16px' }}>
            {riders.length === 0 ? (
              <div className="empty-state">
                <h3>No riders yet</h3>
                <p>Add riders to see reconciliation</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Total Logged</th>
                      <th>Verified</th>
                      <th>Pending</th>
                      <th>Disputed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map(rider => {
                      const riderLogs = logs.filter(l => l.rider_id === rider.id);
                      const verified = riderLogs.filter(l => l.status === 'verified').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
                      const pending = riderLogs.filter(l => l.status === 'pending').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
                      const disputed = riderLogs.filter(l => l.status === 'disputed').reduce((s, l) => s + parseFloat(l.amount || 0), 0);
                      const total = verified + pending + disputed;
                      return (
                        <tr key={rider.id}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{rider.name}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>{rider.phone}</div>
                          </td>
                          <td style={{ fontWeight: '700' }}>GH₵ {total.toFixed(2)}</td>
                          <td style={{ color: '#2ecc71', fontWeight: '600' }}>GH₵ {verified.toFixed(2)}</td>
                          <td style={{ color: '#f39c12', fontWeight: '600' }}>GH₵ {pending.toFixed(2)}</td>
                          <td style={{ color: '#e74c3c', fontWeight: '600' }}>GH₵ {disputed.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Log Cash Collection</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rider *</label>
              <select className="form-input" value={form.rider_id} onChange={e => setForm(f => ({ ...f, rider_id: e.target.value }))}>
                <option value="">Select rider...</option>
                {riders.map(r => <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount Collected (GH₵) *</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Log Cash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cash;
