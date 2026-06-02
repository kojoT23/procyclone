import React, { useState, useEffect, useCallback } from 'react';
import { paymentsAPI } from '../utils/api';

const STATUS_COLORS = {
  pending:  { bg: '#fff3cd', text: '#856404' },
  verified: { bg: '#d4edda', text: '#155724' },
  failed:   { bg: '#f8d7da', text: '#721c24' },
  refunded: { bg: '#e2d9f3', text: '#4a235a' },
};

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [summary, setSummary] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [reference, setReference] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterMethod) params.method = filterMethod;
      const [paymentsRes, summaryRes] = await Promise.all([
        paymentsAPI.getAll(params),
        paymentsAPI.getSummary(),
      ]);
      setPayments(paymentsRes.data.payments || []);
      setTotal(paymentsRes.data.total || 0);
      setPages(paymentsRes.data.pages || 1);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterMethod]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [filterStatus, filterMethod]);

  const openVerify = (payment) => {
    setSelectedPayment(payment);
    setReference('');
    setShowVerifyModal(true);
  };

  const handleVerify = async () => {
    try {
      setVerifying(selectedPayment.id);
      await paymentsAPI.verify(selectedPayment.id, { reference });
      setShowVerifyModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error verifying payment');
    } finally {
      setVerifying(null);
    }
  };

  const handleFail = async (id) => {
    if (!window.confirm('Mark this payment as failed?')) return;
    try {
      await paymentsAPI.fail(id);
      fetchData();
    } catch (err) {
      alert('Error updating payment');
    }
  };

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const verifiedTotal = payments.filter(p => p.status === 'verified').reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>
            {total} payments — {pendingCount} pending verification
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="card" style={{ borderTop: '4px solid #f39c12' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Pending Verification</p>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#f39c12', margin: 0 }}>GH₵ {pendingTotal.toFixed(2)}</h3>
          <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>{pendingCount} payments waiting</p>
        </div>
        <div className="card" style={{ borderTop: '4px solid #2ecc71' }}>
          <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>Verified Today</p>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#2ecc71', margin: 0 }}>GH₵ {verifiedTotal.toFixed(2)}</h3>
        </div>
        {summary?.pending_verification && (
          <div className="card" style={{ borderTop: '4px solid #e74c3c' }}>
            <p style={{ color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 8px' }}>All Pending</p>
            <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#e74c3c', margin: 0 }}>
              GH₵ {parseFloat(summary.pending_verification.total || 0).toFixed(2)}
            </h3>
            <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>{summary.pending_verification.count} total</p>
          </div>
        )}
      </div>

      {/* MoMo verification notice */}
      {pendingCount > 0 && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: '#856404', fontSize: '14px' }}>
              {pendingCount} MoMo payment{pendingCount > 1 ? 's' : ''} need manual verification
            </p>
            <p style={{ margin: '2px 0 0', color: '#856404', fontSize: '12px' }}>
              Check your MTN MoMo account and verify each payment below
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '150px' }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '130px' }}
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
          >
            <option value="">All methods</option>
            <option value="momo">MoMo</option>
            <option value="cash">Cash</option>
          </select>
          {(filterStatus || filterMethod) && (
            <button className="btn btn-secondary" onClick={() => { setFilterStatus(''); setFilterMethod(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
            <h3>No payments yet</h3>
            <p>Payments are created automatically when orders are placed</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Verified By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id}>
                      <td style={{ fontWeight: '600' }}>{payment.order_number || '—'}</td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{payment.customer_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{payment.customer_phone}</div>
                      </td>
                      <td>
                        <span style={{
                          background: payment.method === 'momo' ? '#cce5ff' : '#fff3cd',
                          color: payment.method === 'momo' ? '#004085' : '#856404',
                          padding: '3px 8px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                        }}>
                          {payment.method}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700', color: '#2ecc71', fontSize: '15px' }}>
                        GH₵ {parseFloat(payment.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>{payment.reference || '—'}</td>
                      <td>
                        <span style={{
                          background: STATUS_COLORS[payment.status]?.bg || '#eee',
                          color: STATUS_COLORS[payment.status]?.text || '#333',
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '600', textTransform: 'capitalize',
                        }}>
                          {payment.status}
                        </span>
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>
                        {payment.verified_by_name || '—'}
                        {payment.verified_at && (
                          <div style={{ fontSize: '11px', color: '#aaa' }}>
                            {new Date(payment.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td>
                        {payment.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-success"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => openVerify(payment)}
                              disabled={verifying === payment.id}
                            >
                              ✓ Verify
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleFail(payment.id)}
                            >
                              ✕ Fail
                            </button>
                          </div>
                        )}
                        {payment.status === 'verified' && <span style={{ color: '#2ecc71', fontSize: '12px' }}>✓ Verified</span>}
                        {payment.status === 'failed' && <span style={{ color: '#e74c3c', fontSize: '12px' }}>✕ Failed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {pages}</span>
                <button className="btn btn-secondary" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Verify Modal */}
      {showVerifyModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Verify MoMo Payment</h2>
              <button onClick={() => setShowVerifyModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Order</p>
                  <p style={{ fontWeight: '600', margin: 0 }}>{selectedPayment.order_number}</p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Amount</p>
                  <p style={{ fontWeight: '700', color: '#2ecc71', fontSize: '18px', margin: 0 }}>
                    GH₵ {parseFloat(selectedPayment.amount || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Customer</p>
                  <p style={{ fontWeight: '500', margin: 0 }}>{selectedPayment.customer_name}</p>
                </div>
                <div>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 2px' }}>Phone</p>
                  <p style={{ fontWeight: '500', margin: 0 }}>{selectedPayment.customer_phone}</p>
                </div>
              </div>
            </div>

            <div style={{ background: '#cce5ff', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ color: '#004085', fontSize: '13px', margin: 0, fontWeight: '500' }}>
                📱 Check your MTN MoMo app or USSD (*170#) to confirm this payment was received before verifying.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">MoMo Transaction Reference (optional)</label>
              <input
                className="form-input"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. MP240601123456"
              />
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>
                Found in your MoMo confirmation message
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowVerifyModal(false)}>Cancel</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleVerify} disabled={verifying}>
                {verifying ? 'Verifying...' : '✓ Confirm Payment Received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
