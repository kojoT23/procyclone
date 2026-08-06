import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { ridersAPI } from '../utils/api';
import WhatsAppSettings from './WhatsAppSettings';
import TelegramSettings from './TelegramSettings';
import BusinessProfileTab from '../components/BusinessProfileTab';
import DeliveryPricingTab from '../components/DeliveryPricingTab';
import { useAuth } from '../context/AuthContext';

/* ─── Settings API ────────────────────────────────────────────── */
const settingsAPI = {
  getStats:             ()       => API.get('/settings/stats'),
  getResetLogs:         ()       => API.get('/settings/reset-logs'),
  resetNotifications:   ()       => API.post('/settings/reset/notifications'),
  resetCounters:        (data)   => API.post('/settings/reset/counters', data),
  archiveAndReset:      (data)   => API.post('/settings/reset/archive', data),
  changePassword:       (data)   => API.post('/auth/change-password', data),
};

/* ─── Staff portal access API ────────────────────────────────────
   Mirrors riders.user_id: a granted user can open /portal on
   their phone. Super_admin only. ──────────────────────────────── */
const portalAccessAPI = {
  getList: ()         => API.get('/settings/portal-access'),
  grant:   (userId)   => API.post(`/settings/portal-access/${userId}`),
  revoke:  (userId)   => API.delete(`/settings/portal-access/${userId}`),
};

/* ─── Confirm modal ───────────────────────────────────────────── */
const ConfirmModal = ({ config, onClose, onConfirm, loading }) => {
  const [typed, setTyped] = useState('');
  if (!config) return null;

  const match = typed === config.confirmText;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: '#ef4444' }}>
            {config.icon} {config.title}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Warning box */}
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <strong>Warning:</strong> {config.warning}
        </div>

        {/* What will happen */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--navy)', margin: '0 0 8px' }}>
            This action will:
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.8' }}>
            {config.effects.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="form-group">
          <label className="form-label">
            Type <strong style={{ color: '#ef4444' }}>{config.confirmText}</strong> to confirm
          </label>
          <input
            className="form-input"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={config.confirmText}
            autoFocus
            style={{ borderColor: typed && !match ? '#ef4444' : undefined }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={() => onConfirm(typed)}
            disabled={!match || loading}
          >
            {loading ? 'Processing…' : config.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Settings page
═══════════════════════════════════════════════════════════════ */
const Settings = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = user?.role === 'admin' || isSuperAdmin;

  /* ── State ─────────────────────────────────────────────────── */
  const [activeTab,    setActiveTab]    = useState('general');
  const [stats,        setStats]        = useState(null);
  const [resetLogs,    setResetLogs]    = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [allRiders,    setAllRiders]    = useState([]);
  const [portalStaff,      setPortalStaff]      = useState([]);
  const [loadingPortalStaff, setLoadingPortalStaff] = useState(true);
  const [portalActionId,   setPortalActionId]   = useState(null);
  const [modal,        setModal]        = useState(null); // config object
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,        setToast]        = useState(null);

  /* Password form */
  const [pwForm,    setPwForm]    = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState('');

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingStats(true);
      const [statsRes, logsRes, ridersRes] = await Promise.all([
        settingsAPI.getStats(),
        settingsAPI.getResetLogs(),
        ridersAPI.getAll({ limit: 100 }),
      ]);
      setAllRiders(ridersRes.data.riders || []);
      setStats(statsRes.data.stats);
      setResetLogs(logsRes.data.logs || []);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Staff portal access ──────────────────────────────────────── */
  const fetchPortalStaff = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setLoadingPortalStaff(true);
      const res = await portalAccessAPI.getList();
      setPortalStaff(res.data.staff || []);
    } catch {
      setPortalStaff([]);
    } finally {
      setLoadingPortalStaff(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { fetchPortalStaff(); }, [fetchPortalStaff]);

  const togglePortalAccess = async (member) => {
    setPortalActionId(member.id);
    try {
      if (member.portal_access) {
        await portalAccessAPI.revoke(member.id);
        showToast(`Revoked portal access for ${member.name}`);
      } else {
        await portalAccessAPI.grant(member.id);
        showToast(`Granted portal access to ${member.name}`);
      }
      fetchPortalStaff();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update portal access', 'danger');
    } finally {
      setPortalActionId(null);
    }
  };

  /* ── Toast helper ──────────────────────────────────────────── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Password change ───────────────────────────────────────── */
  const handlePasswordChange = async () => {
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirm) {
      return setPwError('New passwords do not match');
    }
    if (pwForm.newPassword.length < 8) {
      return setPwError('Password must be at least 8 characters');
    }
    if (!/\d/.test(pwForm.newPassword)) {
      return setPwError('Password must contain at least one number');
    }
    try {
      setPwLoading(true);
      await settingsAPI.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      showToast('Password changed successfully');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  /* ── Modal configs ─────────────────────────────────────────── */
  const MODAL_CONFIGS = {
    notifications: {
      title:       'Clear Pending Notifications',
      icon:        '🔔',
      warning:     'This will mark all pending cash logs and payments as verified.',
      effects: [
        'All pending cash logs → marked as verified',
        'All pending payments → marked as verified',
        'No data will be deleted',
      ],
      confirmText: 'RESET',
      btnLabel:    'Clear Notifications',
    },
    counters: {
      title:       'Reset Daily Counters',
      icon:        '🔄',
      warning:     'This will delete historical cash logs and reset failed orders. This cannot be undone.',
      effects: [
        'Cash logs from previous days will be deleted',
        'Failed and returned orders reset to pending',
        'Failed payments reset to pending',
        "Today's data is kept",
      ],
      confirmText: 'RESET',
      btnLabel:    'Reset Counters',
    },
    archive: {
      title:       'Archive & Full Reset',
      icon:        '⚠️',
      warning:     'DESTRUCTIVE ACTION. All operational data will be archived then permanently deleted from the live system.',
      effects: [
        'All orders archived to archive_orders table',
        'All cash logs archived to archive_cash_logs table',
        'All payments archived to archive_payments table',
        'All deliveries and order items deleted',
        'All rider statuses reset to available',
        'Products, customers and riders are kept',
      ],
      confirmText: 'ARCHIVE AND RESET',
      btnLabel:    'Archive & Reset Everything',
    },
  };

  /* ── Confirm action ────────────────────────────────────────── */
  const handleConfirm = async (confirmText) => {
    try {
      setActionLoading(true);
      let res;
      if (modal === 'notifications') {
        res = await settingsAPI.resetNotifications();
      } else if (modal === 'counters') {
        res = await settingsAPI.resetCounters({ confirm_text: confirmText });
      } else if (modal === 'archive') {
        res = await settingsAPI.archiveAndReset({ confirm_text: confirmText });
      }
      setModal(null);
      showToast(res?.data?.message || 'Action completed successfully');
      fetchStats();
    } catch (err) {
      setModal(null);
      showToast(err.response?.data?.message || 'Action failed', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Tabs ──────────────────────────────────────────────────── */
  const tabs = [
  { key: 'general',  label: '🏪 General'  },
  { key: 'business', label: '🏢 Business Profile' },
  { key: 'delivery',  label: '🚚 Delivery & Pricing' }, 
  { key: 'account',  label: '👤 Account'  },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'telegram', label: '✈️ Telegram' },
  ...(isSuperAdmin ? [{ key: 'portal-access', label: '📱 Portal Access' }] : []),
  ...(isAdmin ? [{ key: 'danger', label: '⚠️ Danger Zone' }] : []),
];
  /* ── Action log label ──────────────────────────────────────── */
  const actionLabel = (action) => {
    const map = {
      reset_notifications:  '🔔 Cleared notifications',
      reset_daily_counters: '🔄 Reset daily counters',
      archive_and_reset:    '⚠️ Archive & full reset',
    };
    return map[action] || action;
  };

  /* ══════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`alert alert-${toast.type}`}
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            minWidth: '260px', maxWidth: '360px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and system configuration</p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="tabs" style={{ marginBottom: '24px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={tab.key === 'danger' ? { color: activeTab === 'danger' ? undefined : '#ef4444' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          TAB: General
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Store info */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              Store Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Store Name',    value: 'Shorewinds' },
                { label: 'Country',       value: 'Ghana' },
                { label: 'Currency',      value: 'GH₵ (Ghanaian Cedi)' },
                { label: 'Timezone',      value: 'Africa/Accra (GMT+0)' },
                { label: 'Backend Port',  value: '5001' },
                { label: 'Frontend Port', value: '3000' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {label}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--navy)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Current user info */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              Logged In As
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'var(--accent, #22c55e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '800', fontSize: '18px', flexShrink: 0,
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '16px', color: 'var(--navy)' }}>
                  {user?.name}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-2)' }}>
                  {user?.email}
                </p>
                <span className="badge badge-green" style={{ textTransform: 'capitalize' }}>
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* System stats — admins only */}
          {isAdmin && (
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                System Overview
              </h3>
              {loadingStats ? (
                <div className="loading">
                  <div className="loading-spinner" />
                  <span className="loading-text">Loading stats…</span>
                </div>
              ) : stats ? (
                <div className="stats-grid">
                  {[
                    { label: 'Orders',           value: stats.orders,           color: '#3b82f6' },
                    { label: 'Cash Logs',         value: stats.cash_logs,        color: '#22c55e' },
                    { label: 'Payments',          value: stats.payments,         color: '#8b5cf6' },
                    { label: 'Customers',         value: stats.customers,        color: '#f59e0b' },
                    { label: 'Active Riders',     value: stats.riders,           color: '#14b8a6' },
                    { label: 'Active Products',   value: stats.products,         color: '#ef4444' },
                    { label: 'Pending Cash',      value: stats.pending_cash,     color: '#f59e0b' },
                    { label: 'Pending Payments',  value: stats.pending_payments, color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="stat-card"
                      style={{ borderTop: `4px solid ${color}` }}
                    >
                      <p style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 6px' }}>
                        {label}
                      </p>
                      <h3 style={{ fontSize: '26px', fontWeight: '800', color, margin: 0 }}>
                        {value ?? '—'}
                      </h3>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Unable to load stats.</p>
              )}
            </div>
          )}
        </div>
      )}
      
     {/* ════════════════════════════════════════════════════════
          TAB: Business Profile
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'business' && <BusinessProfileTab currentUser={user} />} 
      {activeTab === 'delivery' && <DeliveryPricingTab currentUser={user} />}

      {/* ════════════════════════════════════════════════════════
          TAB: Account
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>
              Change Password
            </h3>
            <p className="page-subtitle" style={{ margin: '0 0 20px' }}>
              Use a strong password with at least 8 characters and one number.
            </p>

            {pwError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
                {pwError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="At least 8 characters + 1 number"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
                style={{
                  borderColor: pwForm.confirm && pwForm.confirm !== pwForm.newPassword
                    ? '#ef4444' : undefined,
                }}
              />
              {pwForm.confirm && pwForm.confirm !== pwForm.newPassword && (
                <p style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0 0' }}>
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={handlePasswordChange}
              disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirm}
              style={{ width: '100%' }}
            >
              {pwLoading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: WhatsApp
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'whatsapp' && <WhatsAppSettings />}

      {activeTab === 'telegram' && <TelegramSettings riders={allRiders} />}

      {/* ════════════════════════════════════════════════════════
          TAB: Portal Access (super_admin ONLY)
          Mirrors the "Link Staff Account" pattern on the Riders
          page — granting access here is what lets an admin/
          manager/super_admin open /portal on their phone.
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'portal-access' && isSuperAdmin && (
        <div className="card" style={{ maxWidth: '720px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>
            Staff Portal Access
          </h3>
          <p className="page-subtitle" style={{ margin: '0 0 20px' }}>
            Choose which admins, managers, and super admins can use the mobile portal at{' '}
            <code>/portal</code>. This only controls whether they can open the portal app —
            their existing role still decides what they can see and do once inside.
          </p>

          {loadingPortalStaff ? (
            <div className="loading"><div className="loading-spinner" /></div>
          ) : portalStaff.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No staff accounts found.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Portal Access</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {portalStaff.map(member => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td style={{ color: 'var(--text-3)' }}>{member.email}</td>
                      <td style={{ textTransform: 'capitalize' }}>{member.role?.replace('_', ' ')}</td>
                      <td>
                        <span
                          className={`badge ${member.portal_access ? 'badge-success' : 'badge-secondary'}`}
                        >
                          {member.portal_access ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn ${member.portal_access ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          disabled={portalActionId === member.id}
                          onClick={() => togglePortalAccess(member)}
                        >
                          {portalActionId === member.id
                            ? 'Saving…'
                            : member.portal_access ? 'Revoke' : 'Grant'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: Danger Zone (admin + super_admin only)
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'danger' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Warning banner */}
          <div className="alert alert-danger">
            <strong>⚠️ Danger Zone</strong> — Actions on this page affect real data and may be irreversible.
            Only perform these actions when you fully understand the consequences.
          </div>

          {/* Action 1 — Clear Notifications (admin + super_admin) */}
          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px', color: 'var(--navy)' }}>
                  🔔 Clear Pending Notifications
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>
                  Mark all pending cash logs and payments as verified.
                  No data is deleted — counters are simply cleared.
                </p>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-amber">
                    {stats?.pending_cash ?? '…'} pending cash logs
                  </span>
                  <span className="badge badge-amber">
                    {stats?.pending_payments ?? '…'} pending payments
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setModal('notifications')}
                style={{ flexShrink: 0 }}
              >
                Clear Notifications
              </button>
            </div>
          </div>

          {/* Action 2 — Reset Daily Counters (admin + super_admin) */}
          <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px', color: 'var(--navy)' }}>
                  🔄 Reset Daily Counters
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>
                  Delete previous-day cash logs and reset failed/returned orders back to pending.
                  Today's data is preserved.
                </p>
                <div style={{ marginTop: '8px' }}>
                  <span className="badge badge-red">
                    {stats?.cash_logs ?? '…'} total cash logs
                  </span>
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setModal('counters')}
                style={{ flexShrink: 0 }}
              >
                Reset Counters
              </button>
            </div>
          </div>

          {/* Action 3 — Archive & Full Reset (super_admin only) */}
          {isSuperAdmin && (
            <div className="card" style={{ borderLeft: '4px solid #7f1d1d', background: '#fff5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#991b1b' }}>
                      ⚠️ Archive & Full Reset
                    </h3>
                    <span className="badge badge-red">Super Admin Only</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d', lineHeight: '1.6' }}>
                    Archives all orders, cash logs, and payments to backup tables,
                    then permanently wipes the live operational data.
                    Products, customers, and riders are <strong>not</strong> affected.
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-red">{stats?.orders ?? '…'} orders</span>
                    <span className="badge badge-red">{stats?.cash_logs ?? '…'} cash logs</span>
                    <span className="badge badge-red">{stats?.payments ?? '…'} payments</span>
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setModal('archive')}
                  style={{ flexShrink: 0 }}
                >
                  Archive & Reset
                </button>
              </div>
            </div>
          )}

          {/* Reset history log */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              Reset History
            </h3>
            {resetLogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No reset actions yet</h3>
                <p>All reset actions will be logged here.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Performed By</th>
                      <th>Role</th>
                      <th>Date</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resetLogs.map(log => {
                      const details = log.details || {};
                      return (
                        <tr key={log.id}>
                          <td style={{ fontWeight: '600' }}>{actionLabel(log.action)}</td>
                          <td>{log.performed_by_name || '—'}</td>
                          <td>
                            <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>
                              {log.performed_by_role?.replace('_', ' ') || '—'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                            {details.archive_tag
                              ? `Tag: ${details.archive_tag}`
                              : details.cash_logs_cleared != null
                              ? `${details.cash_logs_cleared} cash, ${details.payments_cleared} payments`
                              : details.cash_logs_deleted != null
                              ? `${details.cash_logs_deleted} logs deleted`
                              : '—'}
                          </td>
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

      {/* ── Confirm modal ────────────────────────────────────── */}
      {modal && (
        <ConfirmModal
          config={MODAL_CONFIGS[modal]}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default Settings;
