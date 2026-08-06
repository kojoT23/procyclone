import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmt = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS = {
  draft: { bg: '#f3f4f6', color: '#6b7280' },
  final: { bg: '#fef3c7', color: '#d97706' },
  paid:  { bg: '#dcfce7', color: '#16a34a' },
};
const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'uppercase' }}>{status}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   Printable payslip detail — shared by both admin and staff views
═══════════════════════════════════════════════════════════════ */
function PayslipDetail({ payslip, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div className="payslip-print-area" style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '2px solid #1a1a18' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18' }}>Shorewinds</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Payslip</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Employee</span>
          <span style={{ fontWeight: 700 }}>{payslip.user_name || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Period</span>
          <span style={{ fontWeight: 700 }}>{fmtDate(payslip.period_start)} – {fmtDate(payslip.period_end)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Status</span>
          <StatusBadge status={payslip.status} />
        </div>

        <div style={{ background: '#f9f9f8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Earnings</div>
          <Row label="Base Pay" value={payslip.base_pay} />
          {(payslip.allowances || []).map((a, i) => <Row key={i} label={a.label} value={a.amount} />)}
          <Row label="Gross Pay" value={payslip.gross_pay} bold />
        </div>

        <div style={{ background: '#fef2f2', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 8 }}>Deductions</div>
          <Row label="SSNIT (5.5%)" value={payslip.ssnit_amount} negative />
          <Row label="PAYE (Income Tax)" value={payslip.paye_amount} negative />
          {(payslip.deductions || []).map((d, i) => <Row key={i} label={d.label} value={d.amount} negative />)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '2px solid #1a1a18' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Net Pay</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{fmt(payslip.net_pay)}</span>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={() => window.print()} style={{ flex: 1, background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🖨️ Print / Save PDF</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid #e5e7eb' : 'none', marginTop: bold ? 6 : 0, paddingTop: bold ? 8 : 4 }}>
      <span style={{ color: bold ? '#1a1a18' : '#374151' }}>{label}</span>
      <span style={{ color: negative ? '#dc2626' : (bold ? '#1a1a18' : '#374151') }}>{negative ? '– ' : ''}{fmt(value)}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Staff view — read-only list + print
═══════════════════════════════════════════════════════════════ */
function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrAPI.getMyPayslips();
      setPayslips(res.data.payslips || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  if (payslips.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
        <p style={{ color: '#6b7280' }}>No payslips available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {payslips.map(p => (
          <div key={p.id} onClick={() => setSelected(p)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{fmtDate(p.period_start)} – {fmtDate(p.period_end)}</div>
              <div style={{ marginTop: 4 }}><StatusBadge status={p.status} /></div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{fmt(p.net_pay)}</div>
          </div>
        ))}
      </div>
      {selected && <PayslipDetail payslip={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Admin view — generate, finalize, mark paid, delete drafts
═══════════════════════════════════════════════════════════════ */
function AdminPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: '', period_start: '', period_end: '', base_pay: '' });
  const [allowances, setAllowances] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [lineLabel, setLineLabel] = useState('');
  const [lineAmount, setLineAmount] = useState('');
  const [lineType, setLineType] = useState('allowance');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payslipsRes, staffRes] = await Promise.all([
        hrAPI.getAllPayslips({ limit: 100 }),
        usersAPI.getAll({ limit: 200 }),
      ]);
      setPayslips(payslipsRes.data.payslips || []);
      setStaff(staffRes.data.users || staffRes.data.staff || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setForm({ user_id: '', period_start: '', period_end: '', base_pay: '' });
    setAllowances([]);
    setDeductions([]);
    setShowModal(true);
  };

  const addLine = () => {
    if (!lineLabel || !lineAmount) return;
    const line = { label: lineLabel, amount: parseFloat(lineAmount) };
    if (lineType === 'allowance') setAllowances(a => [...a, line]);
    else setDeductions(d => [...d, line]);
    setLineLabel(''); setLineAmount('');
  };

  const handleGenerate = async () => {
    if (!form.user_id || !form.period_start || !form.period_end || !form.base_pay) {
      return alert('Staff member, period and base pay are required');
    }
    try {
      setSaving(true);
      await hrAPI.generatePayslip({ ...form, allowances, deductions });
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating payslip');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (p) => {
    if (!window.confirm('Finalize this payslip? It will become visible to the employee.')) return;
    try {
      await hrAPI.finalizePayslip(p.id);
      fetchData();
    } catch {
      alert('Error finalizing payslip');
    }
  };

  const handleMarkPaid = async (p) => {
    if (!window.confirm('Mark this payslip as paid?')) return;
    try {
      await hrAPI.markPayslipPaid(p.id);
      fetchData();
    } catch {
      alert('Error marking payslip as paid');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('Delete this draft payslip?')) return;
    try {
      await hrAPI.deletePayslip(p.id);
      fetchData();
    } catch {
      alert('Error deleting payslip');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Generate Payslip
        </button>
      </div>

      {payslips.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ color: '#6b7280' }}>No payslips generated yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payslips.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setSelected(p)}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{p.user_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{fmtDate(p.period_start)} – {fmtDate(p.period_end)}</div>
                  <div style={{ marginTop: 6 }}><StatusBadge status={p.status} /></div>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#22c55e' }}>{fmt(p.net_pay)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                {p.status === 'draft' && (
                  <>
                    <button onClick={() => handleFinalize(p)} style={{ flex: 1, background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Finalize</button>
                    <button onClick={() => handleDelete(p)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                  </>
                )}
                {p.status === 'final' && (
                  <button onClick={() => handleMarkPaid(p)} style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark as Paid</button>
                )}
                {p.status === 'paid' && (
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>Paid {fmtDate(p.paid_at)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <PayslipDetail payslip={selected} onClose={() => setSelected(null)} />}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Generate Payslip</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Staff Member *</label>
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
              <option value="">Select staff member…</option>
              {staff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace('_', ' ')})</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Period Start *</label>
                <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Period End *</label>
                <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Base Pay (GH₵) *</label>
            <input type="number" min="0" step="0.01" value={form.base_pay} onChange={e => setForm(f => ({ ...f, base_pay: e.target.value }))} style={{ width: '100%', marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} placeholder="0.00" />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Allowances & Extra Deductions</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <select value={lineType} onChange={e => setLineType(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <option value="allowance">Allowance</option>
                <option value="deduction">Deduction</option>
              </select>
              <input value={lineLabel} onChange={e => setLineLabel(e.target.value)} placeholder="e.g. Transport" style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <input type="number" value={lineAmount} onChange={e => setLineAmount(e.target.value)} placeholder="GH₵" style={{ width: 80, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <button onClick={addLine} style={{ background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', fontWeight: 700, cursor: 'pointer' }}>Add</button>
            </div>

            {(allowances.length > 0 || deductions.length > 0) && (
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                {allowances.map((a, i) => (
                  <div key={`a${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span>+ {a.label}</span><span style={{ color: '#16a34a' }}>{fmt(a.amount)}</span>
                  </div>
                ))}
                {deductions.map((d, i) => (
                  <div key={`d${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span>– {d.label}</span><span style={{ color: '#dc2626' }}>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#fef9c3', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#854d0e', marginBottom: 16 }}>
              SSNIT (5.5%) and PAYE are calculated automatically when generated — review the draft before finalizing.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleGenerate} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Generating…' : 'Generate as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
═══════════════════════════════════════════════════════════════ */
export default function Payslips() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>Payslips</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {isAdmin ? 'Generate and manage staff payslips' : 'View and download your payslips'}
        </p>
      </div>
      {isAdmin ? <AdminPayslips /> : <MyPayslips />}
    </div>
  );
}
