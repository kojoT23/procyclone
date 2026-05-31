import React, { useState, useEffect, useCallback } from 'react';
import { cashAPI, ridersAPI } from '../utils/api';

const Cash = () => {
  const [logs, setLogs] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const totalCollected = logs.filter(l => l.status === 'verified').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const totalPending = logs.filter(l => l.status === 'pending').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

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
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Verified Collections</p>
          <h3 style={{ fontSize: '26px', fontWeight: '700', color: '#2ecc71', margin: 0 }}>GH₵ {totalCollected.toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderTop: '4px solid #f39c12' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Pending Verification</p>
          <h3 style={{ fontSize: '26px', fontWeight: '700', color: '#f39c12', margin: 0 }}>GH₵ {totalPending.toFixed(2)}</h3>
        </div>
        {report && (
          <div className="card" style={{ borderTop: '4px solid #3498db' }}>
            <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Today's Revenue</p>
            <h3 style={{ fontSize: '26px', fontWeight: '700', color: '#3498db', margin: 0 }}>GH₵ {parseFloat(report.total_revenue || 0).toFixed(2)}</h3>
          </div>
        )}
      </div>

      {/* Cash logs table */}
      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px' }}>Cash Logs</h2>
        {loading ? (
          <div className="loading">Loading cash logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>��</div>
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
                    <td style={{ fontWeight: '600' }}>{log.rider_name || '—'}</td>
                    <td style={{ fontWeight: '700', color: '#2ecc71', fontSize: '15px' }}>GH₵ {parseFloat(log.amount || 0).toFixed(2)}</td>
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
                      {log.status === 'pending' && (
                        <button
                          className="btn btn-success"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleVerify(log.id)}
                        >
                          ✓ Verify
                        </button>
                      )}
                      {log.status === 'verified' && (
                        <span style={{ color: '#2ecc71', fontSize: '12px' }}>✓ Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                {riders.map(r => (
                  <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>
                ))}
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
