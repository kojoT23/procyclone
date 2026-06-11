import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ridersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ─── Constants ───────────────────────────────────────────────── */
const VEHICLE_TYPES = ['Motorbike', 'Bicycle', 'Car', 'Van', 'Tricycle'];
const ZONES = ['Accra Central', 'Madina', 'Tema', 'Spintex', 'Kasoa', 'Kumasi', 'Takoradi', 'Other'];

const EMPTY_FORM = {
  // Basic
  name: '', phone: '', vehicle_type: 'Motorbike', vehicle_number: '',
  vehicle_make_model: '', vehicle_color: '', zone: '',
  // Personal
  date_of_birth: '', gender: '', address: '', ghana_card_number: '',
  // License & Insurance
  license_number: '', license_expiry: '',
  insurance_number: '', insurance_expiry: '',
  // Payment
  momo_number: '',
  // Emergency
  emergency_name: '', emergency_phone: '', emergency_relation: '',
  // Photo & notes
  passport_photo: '', notes: '',
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const isExpiringSoon = (dateStr) => {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const today  = new Date();
  const days   = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return days <= 30 && days >= 0;
};

const isExpired = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/* ─── Rider profile card ──────────────────────────────────────── */
const RiderCard = ({ rider, onEdit, onDelete, currentUser }) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const initials = rider.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const licenseExpired  = isExpired(rider.license_expiry);
  const licenseSoon     = isExpiringSoon(rider.license_expiry);
  const insuranceExpired = isExpired(rider.insurance_expiry);
  const insuranceSoon    = isExpiringSoon(rider.insurance_expiry);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      {/* Top strip — green if available, red if busy */}
      <div style={{ height: '6px', background: rider.is_available ? '#22c55e' : '#f59e0b' }} />

      <div style={{ padding: '20px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flexShrink: 0 }}>
            {rider.passport_photo ? (
              <img
                src={rider.passport_photo}
                alt={rider.name}
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f1f5f9' }}
              />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: '800', fontSize: '18px',
              }}>
                {initials}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 4px' }}>{rider.name}</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className={`badge ${rider.is_available ? 'badge-green' : 'badge-amber'}`}>
                {rider.is_available ? '🟢 Available' : '🟡 On Delivery'}
              </span>
              {rider.zone && <span className="badge badge-blue">{rider.zone}</span>}
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>📞</span><span>{rider.phone}</span>
          </div>
          {rider.momo_number && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📱</span><span>MoMo: {rider.momo_number}</span>
            </div>
          )}
          {rider.vehicle_type && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🏍️</span>
              <span>
                {rider.vehicle_make_model || rider.vehicle_type}
                {rider.vehicle_color && ` · ${rider.vehicle_color}`}
                {rider.vehicle_number && ` · ${rider.vehicle_number}`}
              </span>
            </div>
          )}
          {rider.address && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📍</span><span>{rider.address}</span>
            </div>
          )}
          {rider.ghana_card_number && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🪪</span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                {rider.ghana_card_number}
              </span>
            </div>
          )}

          {/* License */}
          {rider.license_number && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>📄</span>
              <span>
                Licence: {rider.license_number}
                {rider.license_expiry && (
                  <span style={{ marginLeft: '6px' }}>
                    {licenseExpired
                      ? <span className="badge badge-red">Expired {fmtDate(rider.license_expiry)}</span>
                      : licenseSoon
                      ? <span className="badge badge-amber">Expires {fmtDate(rider.license_expiry)}</span>
                      : <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>exp. {fmtDate(rider.license_expiry)}</span>
                    }
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Insurance */}
          {rider.insurance_number && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>🛡️</span>
              <span>
                Insurance: {rider.insurance_number}
                {rider.insurance_expiry && (
                  <span style={{ marginLeft: '6px' }}>
                    {insuranceExpired
                      ? <span className="badge badge-red">Expired {fmtDate(rider.insurance_expiry)}</span>
                      : insuranceSoon
                      ? <span className="badge badge-amber">Expires {fmtDate(rider.insurance_expiry)}</span>
                      : <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>exp. {fmtDate(rider.insurance_expiry)}</span>
                    }
                  </span>
                )}
              </span>
            </div>
          )}

          {rider.emergency_name && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>🚨</span>
              <span>{rider.emergency_name} ({rider.emergency_relation}) · {rider.emergency_phone}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(rider)}>✏️ Edit</button>
          {isSuperAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(rider)}>🗑 Delete</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Riders = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [riders,     setRiders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [search,     setSearch]     = useState('');
  const [viewMode,   setViewMode]   = useState('cards');

  /* Modal */
  const [showModal,      setShowModal]      = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [activeSection,  setActiveSection]  = useState('basic');
  const photoInputRef = useRef();

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const res = await ridersAPI.getAll(params);
      setRiders(res.data.riders || []);
      setTotal(res.data.total   || 0);
      setPages(res.data.pages   || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);
  useEffect(() => { setPage(1); },    [search]);

  /* ── Derived counts ──────────────────────────────────────────── */
  const availableCount = riders.filter(r => r.is_available).length;
  const expiredDocs    = riders.filter(r =>
    isExpired(r.license_expiry) || isExpired(r.insurance_expiry)
  ).length;
  const expiringSoon   = riders.filter(r =>
    isExpiringSoon(r.license_expiry) || isExpiringSoon(r.insurance_expiry)
  ).length;

  /* ── Open add / edit ────────────────────────────────────────── */
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveSection('basic');
    setShowModal(true);
  };

  const openEdit = (rider) => {
    setEditing(rider);
    setForm({
      name:               rider.name               || '',
      phone:              rider.phone              || '',
      vehicle_type:       rider.vehicle_type       || 'Motorbike',
      vehicle_number:     rider.vehicle_number     || '',
      vehicle_make_model: rider.vehicle_make_model || '',
      vehicle_color:      rider.vehicle_color      || '',
      zone:               rider.zone               || '',
      date_of_birth:      rider.date_of_birth      ? rider.date_of_birth.split('T')[0] : '',
      gender:             rider.gender             || '',
      address:            rider.address            || '',
      ghana_card_number:  rider.ghana_card_number  || '',
      license_number:     rider.license_number     || '',
      license_expiry:     rider.license_expiry     ? rider.license_expiry.split('T')[0] : '',
      insurance_number:   rider.insurance_number   || '',
      insurance_expiry:   rider.insurance_expiry   ? rider.insurance_expiry.split('T')[0] : '',
      momo_number:        rider.momo_number        || '',
      emergency_name:     rider.emergency_name     || '',
      emergency_phone:    rider.emergency_phone    || '',
      emergency_relation: rider.emergency_relation || '',
      passport_photo:     rider.passport_photo     || '',
      notes:              rider.notes              || '',
    });
    setActiveSection('basic');
    setShowModal(true);
  };

  /* ── Photo upload ────────────────────────────────────────────── */
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, passport_photo: reader.result }));
    reader.readAsDataURL(file);
  };

  /* ── Save ────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.name || !form.phone) return alert('Name and phone are required');
    try {
      setSaving(true);
      if (editing) {
        await ridersAPI.update(editing.id, form);
      } else {
        await ridersAPI.create(form);
      }
      setShowModal(false);
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving rider');
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete (super_admin only) ───────────────────────────────── */
  const handleDelete = async (rider) => {
    if (!window.confirm(`Remove ${rider.name} from the system?`)) return;
    try {
      await ridersAPI.delete(rider.id);
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting rider');
    }
  };

  /* ── Form field helper ───────────────────────────────────────── */
  const f = (field) => ({
    className: 'form-input',
    value: form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  const sections = [
    { key: 'basic',     label: '🏍️ Basic' },
    { key: 'personal',  label: '📋 Personal' },
    { key: 'documents', label: '📄 Documents' },
    { key: 'emergency', label: '🚨 Emergency' },
    { key: 'photo',     label: '📸 Photo' },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders</h1>
          <p className="page-subtitle">{total} riders · {availableCount} available</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px' }}
              onClick={() => setViewMode('cards')}
            >⊞ Cards</button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px' }}
              onClick={() => setViewMode('table')}
            >☰ Table</button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Rider</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-icon">🏍️</span>
          <p className="stat-label">Total Riders</p>
          <p className="stat-value" style={{ color: 'var(--navy)' }}>{total}</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🟢</span>
          <p className="stat-label">Available Now</p>
          <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>{availableCount}</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🟡</span>
          <p className="stat-label">On Delivery</p>
          <p className="stat-value" style={{ color: '#f59e0b' }}>{total - availableCount}</p>
        </div>
        {(expiredDocs > 0 || expiringSoon > 0) && (
          <div className="stat-card">
            <span className="stat-icon">⚠️</span>
            <p className="stat-label">Doc Alerts</p>
            <p className="stat-value" style={{ color: '#ef4444' }}>{expiredDocs}</p>
            <p className="stat-sub">{expiringSoon} expiring soon</p>
          </div>
        )}
      </div>

      {/* Document expiry alerts */}
      {expiredDocs > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <strong>⚠️ {expiredDocs} rider{expiredDocs > 1 ? 's have' : ' has'} expired licence or insurance.</strong>
          {' '}Update their documents before assigning deliveries.
        </div>
      )}
      {expiringSoon > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <strong>⏰ {expiringSoon} rider{expiringSoon > 1 ? 's have' : ' has'} documents expiring within 30 days.</strong>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="🔍 Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {search && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear</button>
          )}
          <span className="pagination-info">{total} result{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Loading riders…</span>
        </div>
      ) : riders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏍️</div>
          <h3>No riders found</h3>
          <p>{search ? 'No riders match your search.' : 'Add your first rider to get started.'}</p>
          {!search && (
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAdd}>+ Add Rider</button>
          )}
        </div>
      ) : (
        <>
          {/* Card grid */}
          {viewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {riders.map(rider => (
                <RiderCard
                  key={rider.id}
                  rider={rider}
                  currentUser={currentUser}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Vehicle</th>
                      <th>Zone</th>
                      <th>Ghana Card</th>
                      <th>Licence</th>
                      <th>Insurance</th>
                      <th>MoMo</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map(rider => (
                      <tr key={rider.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {rider.passport_photo ? (
                              <img src={rider.passport_photo} alt={rider.name}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: '#0f172a', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '12px', flexShrink: 0,
                              }}>
                                {rider.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: '600' }}>{rider.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{rider.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                          <div>{rider.vehicle_make_model || rider.vehicle_type || '—'}</div>
                          {rider.vehicle_number && <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace' }}>{rider.vehicle_number}</div>}
                          {rider.vehicle_color && <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{rider.vehicle_color}</div>}
                        </td>
                        <td>{rider.zone ? <span className="badge badge-blue">{rider.zone}</span> : '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-2)' }}>{rider.ghana_card_number || '—'}</td>
                        <td>
                          {rider.license_number ? (
                            <div>
                              <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>{rider.license_number}</div>
                              {rider.license_expiry && (
                                isExpired(rider.license_expiry)
                                  ? <span className="badge badge-red">Expired</span>
                                  : isExpiringSoon(rider.license_expiry)
                                  ? <span className="badge badge-amber">Soon</span>
                                  : <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtDate(rider.license_expiry)}</span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          {rider.insurance_number ? (
                            <div>
                              <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>{rider.insurance_number}</div>
                              {rider.insurance_expiry && (
                                isExpired(rider.insurance_expiry)
                                  ? <span className="badge badge-red">Expired</span>
                                  : isExpiringSoon(rider.insurance_expiry)
                                  ? <span className="badge badge-amber">Soon</span>
                                  : <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtDate(rider.insurance_expiry)}</span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-2)' }}>{rider.momo_number || '—'}</td>
                        <td>
                          <span className={`badge ${rider.is_available ? 'badge-green' : 'badge-amber'}`}>
                            {rider.is_available ? 'Available' : 'On Delivery'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(rider)}>Edit</button>
                            {isSuperAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rider)}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination" style={{ marginTop: '16px' }}>
              <span className="pagination-info">Page {page} of {pages} · {total} riders</span>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          Rider Profile Modal
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editing ? `Edit — ${editing.name}` : 'Add New Rider'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Section tabs */}
            <div className="tabs" style={{ marginBottom: '20px' }}>
              {sections.map(s => (
                <button
                  key={s.key}
                  className={`tab-btn${activeSection === s.key ? ' active' : ''}`}
                  onClick={() => setActiveSection(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* ── Basic ──────────────────────────────────────── */}
            {activeSection === 'basic' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input {...f('name')} placeholder="e.g. Kwame Asante" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input {...f('phone')} placeholder="e.g. 0244123456" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <select {...f('vehicle_type')}>
                      {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Number</label>
                    <input {...f('vehicle_number')} placeholder="e.g. GR-1234-22" style={{ textTransform: 'uppercase' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Make / Model</label>
                    <input {...f('vehicle_make_model')} placeholder="e.g. Honda CB125" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Color</label>
                    <input {...f('vehicle_color')} placeholder="e.g. Red" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Delivery Zone</label>
                    <select {...f('zone')}>
                      <option value="">Select zone…</option>
                      {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">MoMo Number</label>
                    <input {...f('momo_number')} placeholder="e.g. 0244123456" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Personal ───────────────────────────────────── */}
            {activeSection === 'personal' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input {...f('date_of_birth')} type="date" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select {...f('gender')}>
                      <option value="">Select…</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Home Address</label>
                  <textarea {...f('address')} rows={2} placeholder="e.g. Madina, Accra" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ghana Card Number</label>
                  <input {...f('ghana_card_number')} placeholder="GHA-000000000-0" style={{ fontFamily: 'monospace' }} />
                </div>
              </div>
            )}

            {/* ── Documents ──────────────────────────────────── */}
            {activeSection === 'documents' && (
              <div>
                <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                  Keep licence and insurance up to date. You'll get alerts when they expire or are close to expiry.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Driver's Licence Number</label>
                    <input {...f('license_number')} placeholder="e.g. DL-123456" style={{ fontFamily: 'monospace' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Licence Expiry Date</label>
                    <input {...f('license_expiry')} type="date" />
                    {form.license_expiry && isExpired(form.license_expiry) && (
                      <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>⚠️ This licence has expired</p>
                    )}
                    {form.license_expiry && isExpiringSoon(form.license_expiry) && !isExpired(form.license_expiry) && (
                      <p style={{ color: '#f59e0b', fontSize: '12px', margin: '4px 0 0' }}>⏰ Expiring within 30 days</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Insurance Number</label>
                    <input {...f('insurance_number')} placeholder="e.g. INS-789012" style={{ fontFamily: 'monospace' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Insurance Expiry Date</label>
                    <input {...f('insurance_expiry')} type="date" />
                    {form.insurance_expiry && isExpired(form.insurance_expiry) && (
                      <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>⚠️ This insurance has expired</p>
                    )}
                    {form.insurance_expiry && isExpiringSoon(form.insurance_expiry) && !isExpired(form.insurance_expiry) && (
                      <p style={{ color: '#f59e0b', fontSize: '12px', margin: '4px 0 0' }}>⏰ Expiring within 30 days</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Emergency ──────────────────────────────────── */}
            {activeSection === 'emergency' && (
              <div>
                <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                  This contact will be reached in case of an emergency involving this rider.
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input {...f('emergency_name')} placeholder="e.g. Akosua Mensah" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input {...f('emergency_phone')} placeholder="e.g. 0201234567" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <select {...f('emergency_relation')}>
                      <option value="">Select…</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Child">Child</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Photo & Notes ───────────────────────────────── */}
            {activeSection === 'photo' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Passport Photo</label>
                  {form.passport_photo && (
                    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                      <img
                        src={form.passport_photo}
                        alt="Passport"
                        style={{ width: '120px', height: '150px', objectFit: 'cover', borderRadius: '8px', border: '2px solid var(--border)' }}
                      />
                    </div>
                  )}
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border)', borderRadius: '10px',
                      padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📸</div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px', fontSize: '14px' }}>
                      {form.passport_photo ? 'Click to change photo' : 'Click to upload passport photo'}
                    </p>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: 0 }}>JPG or PNG · Max 2MB</p>
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    style={{ display: 'none' }}
                    onChange={handlePhotoUpload}
                  />
                  {form.passport_photo && (
                    <button className="btn btn-danger btn-sm" style={{ marginTop: '8px' }}
                      onClick={() => setForm(f => ({ ...f, passport_photo: '' }))}>
                      Remove photo
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea {...f('notes')} rows={3} placeholder="Any additional notes about this rider…" />
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Riders;
