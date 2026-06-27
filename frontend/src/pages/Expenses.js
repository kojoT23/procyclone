import React, { useState, useEffect, useCallback } from 'react';
import { expensesAPI } from '../utils/api';

const CATEGORIES = ['fuel', 'salaries', 'packaging', 'maintenance', 'rent', 'utilities', 'other'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer'];

const categoryColors = {
  fuel: '#f59e0b', salaries: '#3b82f6', packaging: '#8b5cf6',
  maintenance: '#ef4444', rent: '#ec4899', utilities: '#14b8a6', other: '#6b7280'
};

const fmt = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ category: 'all', start_date: '', end_date: '' });
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [form, setForm] = useState({ category: 'fuel', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      const res = await expensesAPI.getAll(params);
      if (res.data.success) {
        setExpenses(res.data.expenses);
        setPages(res.data.pages);
        setTotal(res.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      const res = await expensesAPI.getSummary(params);
      if (res.data.success) setSummary(res.data);
    } catch (e) { console.error(e); }
  }, [filters]);

  useEffect(() => { fetchExpenses(); fetchSummary(); }, [fetchExpenses, fetchSummary]);

  const openAdd = () => {
    setEditExpense(null);
    setForm({ category: 'fuel', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash', notes: '' });
    setShowModal(true);
  };

  const openEdit = (exp) => {
    setEditExpense(exp);
    setForm({ category: exp.category, description: exp.description, amount: exp.amount, expense_date: exp.expense_date?.split('T')[0], payment_method: exp.payment_method, notes: exp.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return alert('Description and amount are required');
    setSaving(true);
    try {
      const res = editExpense
        ? await expensesAPI.update(editExpense.id, form)
        : await expensesAPI.create(form);
      if (res.data.success) { setShowModal(false); fetchExpenses(); fetchSummary(); }
      else alert(res.data.message);
    } catch (e) { console.error(e); alert('Failed to save expense'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      const res = await expensesAPI.delete(id);
      if (res.data.success) { fetchExpenses(); fetchSummary(); }
    } catch (e) { console.error(e); }
  };

  const exportCSV = () => {
    const rows = [['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes']];
    expenses.forEach(e => rows.push([e.expense_date?.split('T')[0], e.category, e.description, e.amount, e.payment_method, e.notes || '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'expenses.csv'; a.click();
  };

  const biggestCategory = summary?.by_category?.[0];
  const totalExpenses = summary?.total_expenses || 0;
  const thisMonth = summary?.this_month || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Expenses</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Track costs and monitor profitability</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Expenses (Period)</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{fmt(totalExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{fmt(thisMonth)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Biggest Category</div>
          <div className="stat-value" style={{ fontSize: 18, textTransform: 'capitalize' }}>{biggestCategory?.category || '—'}</div>
          {biggestCategory && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{fmt(biggestCategory.total)}</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value">{total}</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>Expense List</button>
        <button className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>By Category</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div className="expenses-filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" style={{ width: 160 }} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          <input type="date" className="form-input" style={{ width: 160 }} value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          <button className="btn" onClick={() => setFilters({ category: 'all', start_date: '', end_date: '' })}>Clear</button>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          {loading ? (
            <div className="loading">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 40 }}>💸</div>
              <p>No expenses found</p>
              <button className="btn btn-primary" onClick={openAdd}>Add First Expense</button>
            </div>
          ) : (
            <>
              <div className="expenses-table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    {['Date', 'Category', 'Description', 'Amount', 'Payment', 'Added By', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px', fontSize: 14, color: '#6b7280' }}>{exp.expense_date?.split('T')[0]}</td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge" style={{ background: categoryColors[exp.category] + '20', color: categoryColors[exp.category], textTransform: 'capitalize' }}>{exp.category}</span>
                      </td>
                      <td style={{ padding: '12px', fontSize: 14, fontWeight: 500 }}>{exp.description}</td>
                      <td style={{ padding: '12px', fontSize: 14, fontWeight: 600, color: '#ef4444' }}>{fmt(exp.amount)}</td>
                      <td style={{ padding: '12px', fontSize: 13, color: '#6b7280', textTransform: 'capitalize' }}>{exp.payment_method?.replace('_', ' ')}</td>
                      <td style={{ padding: '12px', fontSize: 13, color: '#6b7280' }}>{exp.created_by_name || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(exp)}>Edit</button>
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleDelete(exp.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
                  <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span style={{ padding: '8px 16px', fontSize: 14, color: '#6b7280' }}>Page {page} of {pages}</span>
                  <button className="btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'chart' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Spending by Category</h3>
          {!summary?.by_category?.length ? (
            <div className="empty-state" style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><p>No data available</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {summary.by_category.map(cat => {
                const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                return (
                  <div key={cat.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>{cat.category}</span>
                      <span style={{ fontSize: 14, color: '#6b7280' }}>{fmt(cat.total)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: categoryColors[cat.category], borderRadius: 99, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Description</label>
                <input className="form-input" placeholder="e.g. Fuel for delivery van" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Amount (GHS)</label>
                <input className="form-input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date</label>
                <input className="form-input" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Payment Method</label>
                <select className="form-input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Notes (optional)</label>
                <textarea className="form-input" rows={2} placeholder="Any additional details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editExpense ? 'Update' : 'Add Expense'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
