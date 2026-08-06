import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const DOC_TYPE_LABELS = {
  offer_letter: '📝 Offer Letter',
  warning_letter: '⚠️ Warning Letter',
  termination_letter: '📄 Termination Letter',
  id_card: '🪪 ID Card',
};

const TEMPLATES = {
  offer_letter: (name, role) =>
    `Dear ${name},\n\nWe are pleased to offer you the position of ${role} at Shorewinds. This letter confirms your appointment, effective from the date agreed with your manager.\n\nWe look forward to having you on the team.\n\nSincerely,\nShorewinds Management`,
  warning_letter: (name) =>
    `Dear ${name},\n\nThis letter serves as a formal warning regarding [describe the issue here]. We expect immediate improvement in this area.\n\nPlease treat this matter seriously.\n\nShorewinds Management`,
  termination_letter: (name) =>
    `Dear ${name},\n\nThis letter confirms the termination of your employment with Shorewinds, effective [date].\n\nPlease contact HR regarding final settlement and handover.\n\nShorewinds Management`,
  id_card: () => '',
};

/* ═══════════════════════════════════════════════════════════════
   ID card visual — used for both admin preview and staff view
═══════════════════════════════════════════════════════════════ */
function IDCard({ name, role, userId }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 300, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', margin: '0 auto',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Staff<span style={{ color: '#d4af37' }}>X</span></div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Shorewinds Employee ID</div>
      </div>
      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
          background: 'linear-gradient(135deg, #d4af37, #b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 26, color: '#1a1a18',
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{name}</div>
        <div style={{ fontSize: 12, color: '#d4af37', textTransform: 'capitalize', marginTop: 2 }}>{role?.replace('_', ' ')}</div>
      </div>
      <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
        <span>ID: SW-{String(userId).padStart(5, '0')}</span>
        <span>shorewinds.com</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Staff view — own documents, printable
═══════════════════════════════════════════════════════════════ */
function MyDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrAPI.getMyDocuments();
      setDocuments(res.data.documents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>My ID Card</div>
        <IDCard name={user?.name} role={user?.role} userId={user?.id} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>My Documents</div>
      {documents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 30, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#6b7280', fontSize: 13 }}>No letters or documents issued yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(d => (
            <div key={d.id} onClick={() => setSelected(d)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{d.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{DOC_TYPE_LABELS[d.doc_type] || d.doc_type} · {fmtDate(d.generated_at)}</div>
              </div>
              <span style={{ fontSize: 16, color: '#9ca3af' }}>›</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div className="payslip-print-area" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{DOC_TYPE_LABELS[selected.doc_type]}</div>
            <h2 style={{ fontSize: 17, margin: '0 0 16px' }}>{selected.title}</h2>
            <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.content}</div>
            <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close</button>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🖨️ Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Admin view — generate letters for staff
═══════════════════════════════════════════════════════════════ */
function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: '', doc_type: 'offer_letter', title: '', content: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsRes, staffRes] = await Promise.all([
        hrAPI.getAllDocuments(),
        usersAPI.getAll({ limit: 200 }),
      ]);
      setDocuments(docsRes.data.documents || []);
      setStaff(staffRes.data.users || staffRes.data.staff || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setForm({ user_id: '', doc_type: 'offer_letter', title: '', content: '' });
    setShowModal(true);
  };

  const applyTemplate = (docType, userId) => {
    const staffMember = staff.find(s => s.id === parseInt(userId));
    if (!staffMember) return '';
    return TEMPLATES[docType]?.(staffMember.name, staffMember.role?.replace('_', ' ')) || '';
  };

  const handleUserOrTypeChange = (field, value) => {
    const nextForm = { ...form, [field]: value };
    if (nextForm.doc_type !== 'id_card' && nextForm.user_id) {
      nextForm.content = applyTemplate(nextForm.doc_type, nextForm.user_id);
    }
    setForm(nextForm);
  };

  const handleGenerate = async () => {
    if (!form.user_id || !form.doc_type || !form.title) return alert('Staff member, document type and title are required');
    if (form.doc_type !== 'id_card' && !form.content) return alert('Content is required for letters');
    try {
      setSaving(true);
      await hrAPI.generateDocument({ ...form, content: form.doc_type === 'id_card' ? 'ID Card issued' : form.content });
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating document');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try {
      await hrAPI.deleteDocument(d.id);
      fetchData();
    } catch {
      alert('Error deleting document');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Generate Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <p style={{ color: '#6b7280' }}>No documents generated yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(d => (
            <div key={d.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{d.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.user_name} · {DOC_TYPE_LABELS[d.doc_type] || d.doc_type} · {fmtDate(d.generated_at)}</div>
              </div>
              <button onClick={() => handleDelete(d)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Generate Document</h3>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Staff Member *</label>
            <select value={form.user_id} onChange={e => handleUserOrTypeChange('user_id', e.target.value)} style={inputStyle}>
              <option value="">Select staff member…</option>
              {staff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace('_', ' ')})</option>)}
            </select>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Document Type *</label>
            <select value={form.doc_type} onChange={e => handleUserOrTypeChange('doc_type', e.target.value)} style={inputStyle}>
              {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Offer Letter — June 2026" style={inputStyle} />

            {form.doc_type === 'id_card' ? (
              form.user_id ? (
                <div style={{ marginBottom: 10 }}>
                  <IDCard name={staff.find(s => s.id === parseInt(form.user_id))?.name} role={staff.find(s => s.id === parseInt(form.user_id))?.role} userId={form.user_id} />
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 10 }}>Select a staff member to preview the ID card</p>
              )
            ) : (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Content * (auto-filled — edit as needed)</label>
                <textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleGenerate} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box' };

/* ═══════════════════════════════════════════════════════════════
   Entry point
═══════════════════════════════════════════════════════════════ */
export default function Documents() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>Documents</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {isAdmin ? 'Generate employment letters and ID cards' : 'Your ID card and employment letters'}
        </p>
      </div>
      {isAdmin ? <AdminDocuments /> : <MyDocuments />}
    </div>
  );
}
