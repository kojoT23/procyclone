import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = {
  super_admin: '#dc2626', admin: '#d97706', manager: '#1d4ed8',
  accountant: '#0f766e', customer_support: '#7c3aed', cashier: '#16a34a',
  dispatcher: '#8b5cf6', warehouse: '#f59e0b', auditor: '#64748b', rider: '#475569',
};

export default function RBAC() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [resetting, setResetting] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRBAC = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/rbac');
      if (res.data.success) {
        setData(res.data);
        setSelectedRole(res.data.roles[1]?.key || res.data.roles[0]?.key);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRBAC(); }, [fetchRBAC]);

  const togglePermission = async (role, permission, currentGranted) => {
    if (role === 'super_admin') return;
    const key = `${role}-${permission}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await API.put('/rbac', { role, permission, granted: !currentGranted });
      if (res.data.success) {
        setData(prev => ({
          ...prev,
          roles: prev.roles.map(r => r.key !== role ? r : {
            ...r,
            permissions: r.permissions.map(p => p.key !== permission ? p : { ...p, granted: !currentGranted }),
          }),
        }));
        showToast(`${permission.replace(/_/g, ' ')} ${!currentGranted ? 'granted to' : 'revoked from'} ${role.replace(/_/g, ' ')}`);
      }
    } catch (e) { showToast('Failed to update permission', 'error'); }
    setSaving(s => ({ ...s, [key]: false }));
  };

  const resetRole = async (role) => {
    if (!window.confirm(`Reset ${role.replace(/_/g, ' ')} to default permissions?`)) return;
    setResetting(role);
    try {
      const res = await API.post(`/rbac/reset/${role}`);
      if (res.data.success) { showToast(res.data.message); fetchRBAC(); }
    } catch (e) { showToast('Failed to reset role', 'error'); }
    setResetting(null);
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="empty-state" style={{ minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h3>Access Denied</h3>
        <p>Only Super Admin can manage permissions.</p>
      </div>
    );
  }

  if (loading) return <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading permissions…</span></div>;

  const currentRole = data?.roles?.find(r => r.key === selectedRole);
  const permissions = data?.permissions || [];

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Permissions Matrix</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Control what each role can access. Super Admin permissions cannot be changed.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Role list */}
        <div className="card" style={{ padding: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 12px 4px', margin: 0 }}>Roles</p>
          {data?.roles?.map(role => (
            <button
              key={role.key}
              onClick={() => setSelectedRole(role.key)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: selectedRole === role.key ? ROLE_COLORS[role.key] + '15' : 'transparent',
                borderLeft: selectedRole === role.key ? `3px solid ${ROLE_COLORS[role.key]}` : '3px solid transparent',
                marginBottom: 2, transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[role.key], flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {role.permissions.filter(p => p.granted).length}/{permissions.length} permissions
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Permission toggles */}
        {currentRole && (
          <div>
            <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ROLE_COLORS[currentRole.key] }} />
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{currentRole.label}</h2>
                    {currentRole.key === 'super_admin' && (
                      <span className="badge badge-red" style={{ fontSize: 10 }}>🔒 Protected</span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{currentRole.description}</p>
                </div>
                {currentRole.key !== 'super_admin' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => resetRole(currentRole.key)}
                    disabled={resetting === currentRole.key}
                  >
                    {resetting === currentRole.key ? 'Resetting…' : '↺ Reset to defaults'}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {permissions.map((perm, i) => {
                const rolePerm = currentRole.permissions.find(p => p.key === perm.key);
                const granted = rolePerm?.granted || false;
                const overridden = rolePerm?.overridden || false;
                const key = `${currentRole.key}-${perm.key}`;
                const isSaving = saving[key];
                const isLocked = currentRole.key === 'super_admin';

                return (
                  <div
                    key={perm.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < permissions.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: granted ? '#f0fdf4' : '#fff',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>
                          {perm.label}
                        </span>
                        {overridden && (
                          <span style={{ fontSize: 10, background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{perm.description}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: granted ? '#22c55e' : '#9ca3af', fontWeight: 600 }}>
                        {granted ? 'Granted' : 'Denied'}
                      </span>
                      <button
                        onClick={() => !isLocked && !isSaving && togglePermission(currentRole.key, perm.key, granted)}
                        disabled={isLocked || isSaving}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none',
                          background: isLocked ? '#e5e7eb' : granted ? '#22c55e' : '#d1d5db',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                          opacity: isSaving ? 0.6 : 1,
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3,
                          left: granted ? 23 : 3,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
