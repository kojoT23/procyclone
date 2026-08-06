import React, { useState, useEffect, useCallback } from 'react';
import { hrAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const EMPLOYMENT_LABELS = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };

const STATUS_COLORS = {
  submitted: { bg: '#dbeafe', color: '#1d4ed8' },
  reviewing: { bg: '#fef3c7', color: '#d97706' },
  accepted:  { bg: '#dcfce7', color: '#16a34a' },
  rejected:  { bg: '#fee2e2', color: '#dc2626' },
  open:      { bg: '#dcfce7', color: '#16a34a' },
  closed:    { bg: '#f3f4f6', color: '#6b7280' },
};
const Badge = ({ status }) => {
  const c = STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'uppercase' }}>{status}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   My Career profile tab
═══════════════════════════════════════════════════════════════ */
function MyCareerProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrAPI.getMyCareerProfile()
      .then(res => setProfile(res.data.profile))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;
  if (!profile) return null;

  const years = Math.floor(profile.tenure_days / 365);
  const months = Math.floor((profile.tenure_days % 365) / 30);
  const tenureLabel = years > 0 ? `${years}y ${months}m` : `${months} month${months !== 1 ? 's' : ''}`;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 18, padding: 28, color: '#fff', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37, #b8860b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#1a1a18', flexShrink: 0,
        }}>
          {(profile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize', marginTop: 2 }}>{profile.role?.replace('_', ' ')}</div>
          <div style={{ fontSize: 12, color: '#d4af37', marginTop: 4, fontWeight: 700 }}>At Shorewinds for {tenureLabel}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Joined" value={fmtDate(profile.created_at)} />
        <StatCard label="Days Worked" value={profile.total_days_worked} />
        <StatCard label="Total Hours" value={`${profile.total_hours_worked}h`} />
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Contact Details</div>
        <Row label="Email" value={profile.email} />
        <Row label="Phone" value={profile.phone} />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a18' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#1a1a18' }}>{value || '—'}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Vacancies tab — shared by everyone, admin gets extra controls
═══════════════════════════════════════════════════════════════ */
function Vacancies() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const [vacancies, setVacancies] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [applyNote, setApplyNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', department: '', location: '', employment_type: 'full_time', description: '', requirements: '', closes_at: '' });
  const [applicants, setApplicants] = useState(null);
  const [applicantsFor, setApplicantsFor] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const calls = [hrAPI.getVacancies()];
      if (!isAdmin) calls.push(hrAPI.getMyApplications());
      const results = await Promise.all(calls);
      setVacancies(results[0].data.vacancies || []);
      if (!isAdmin) setMyApplications(results[1].data.applications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasApplied = (vacancyId) => myApplications.some(a => a.vacancy_id === vacancyId);

  const handleApply = async () => {
    if (!selected) return;
    try {
      setApplying(true);
      await hrAPI.applyToVacancy(selected.id, { cover_note: applyNote });
      setSelected(null);
      setApplyNote('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting application');
    } finally {
      setApplying(false);
    }
  };

  const handlePost = async () => {
    if (!postForm.title) return alert('Title is required');
    try {
      setSaving(true);
      await hrAPI.createVacancy(postForm);
      setShowPostModal(false);
      setPostForm({ title: '', department: '', location: '', employment_type: 'full_time', description: '', requirements: '', closes_at: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error posting vacancy');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (v) => {
    try {
      await hrAPI.updateVacancyStatus(v.id, v.status === 'open' ? 'closed' : 'open');
      fetchData();
    } catch {
      alert('Error updating vacancy');
    }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Delete vacancy "${v.title}"?`)) return;
    try {
      await hrAPI.deleteVacancy(v.id);
      fetchData();
    } catch {
      alert('Error deleting vacancy');
    }
  };

  const openApplicants = async (v) => {
    setApplicantsFor(v);
    setApplicants(null);
    try {
      const res = await hrAPI.getApplicants(v.id);
      setApplicants(res.data.applicants || []);
    } catch {
      setApplicants([]);
    }
  };

  const handleApplicantStatus = async (app, status) => {
    try {
      await hrAPI.updateApplicationStatus(app.id, status);
      openApplicants(applicantsFor);
    } catch {
      alert('Error updating applicant status');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setShowPostModal(true)} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Post Vacancy
          </button>
        </div>
      )}

      {vacancies.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <p style={{ color: '#6b7280' }}>No open vacancies right now.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vacancies.map(v => (
            <div key={v.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18' }}>{v.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {v.department ? `${v.department} · ` : ''}{v.location || 'Location TBC'} · {EMPLOYMENT_LABELS[v.employment_type] || v.employment_type}
                  </div>
                </div>
                {isAdmin ? <Badge status={v.status} /> : (hasApplied(v.id) && <Badge status={myApplications.find(a => a.vacancy_id === v.id)?.status} />)}
              </div>
              {v.description && <div style={{ fontSize: 13, color: '#374151', marginTop: 8, whiteSpace: 'pre-wrap' }}>{v.description}</div>}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                {isAdmin ? (
                  <>
                    <button onClick={() => openApplicants(v)} style={{ flex: 1, background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      👥 {v.application_count} Applicant{v.application_count !== '1' ? 's' : ''}
                    </button>
                    <button onClick={() => handleToggleStatus(v)} style={{ background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {v.status === 'open' ? 'Close' : 'Reopen'}
                    </button>
                    <button onClick={() => handleDelete(v)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                  </>
                ) : (
                  !hasApplied(v.id) && (
                    <button onClick={() => setSelected(v)} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Apply Now
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply modal (staff) */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Apply — {selected.title}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 14px' }}>Tell us why you'd be a good fit (optional)</p>
            <textarea rows={4} value={applyNote} onChange={e => setApplyNote(e.target.value)} placeholder="Cover note…" style={{ width: '100%', marginBottom: 16, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleApply} disabled={applying} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {applying ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post vacancy modal (admin) */}
      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowPostModal(false)}>
          <div style={{ background: '#f9f9f8', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Post Vacancy</h3>
            <input placeholder="Job title *" value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Department" value={postForm.department} onChange={e => setPostForm(f => ({ ...f, department: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              <input placeholder="Location" value={postForm.location} onChange={e => setPostForm(f => ({ ...f, location: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <select value={postForm.employment_type} onChange={e => setPostForm(f => ({ ...f, employment_type: e.target.value }))} style={inputStyle}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
            <textarea rows={3} placeholder="Description" value={postForm.description} onChange={e => setPostForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
            <textarea rows={2} placeholder="Requirements" value={postForm.requirements} onChange={e => setPostForm(f => ({ ...f, requirements: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Closes On</label>
            <input type="date" value={postForm.closes_at} onChange={e => setPostForm(f => ({ ...f, closes_at: e.target.value }))} style={{ ...inputStyle, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPostModal(false)} style={{ flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handlePost} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Posting…' : 'Post Vacancy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applicants modal (admin) */}
      {applicantsFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setApplicantsFor(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Applicants — {applicantsFor.title}</h3>
              <button onClick={() => setApplicantsFor(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            {applicants === null ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Loading…</div>
            ) : applicants.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>No applicants yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {applicants.map(a => (
                  <div key={a.id} style={{ background: '#f9f9f8', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.applicant_name} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11, textTransform: 'capitalize' }}>({a.applicant_role?.replace('_', ' ')})</span></div>
                      <Badge status={a.status} />
                    </div>
                    {a.cover_note && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>{a.cover_note}</div>}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Applied {fmtDate(a.applied_at)}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => handleApplicantStatus(a, 'reviewing')} style={{ flex: 1, background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reviewing</button>
                      <button onClick={() => handleApplicantStatus(a, 'accepted')} style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                      <button onClick={() => handleApplicantStatus(a, 'rejected')} style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
export default function Career() {
  const [tab, setTab] = useState('profile');

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px' }}>Career & Vacancies</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Your profile and open positions at Shorewinds</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[{ key: 'profile', label: '👤 My Career' }, { key: 'vacancies', label: '🎓 Vacancies' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === t.key ? '#1a1a18' : '#fff', color: tab === t.key ? '#fff' : '#6b7280',
              boxShadow: tab === t.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? <MyCareerProfile /> : <Vacancies />}
    </div>
  );
}
