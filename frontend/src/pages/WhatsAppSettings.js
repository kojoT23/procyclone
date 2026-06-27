import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

const whatsappAPI = {
  getSettings:   ()       => API.get('/whatsapp/settings'),
  updateSettings:(data)   => API.put('/whatsapp/settings', data),
  getMessages:   (status) => API.get('/whatsapp/messages', { params: { status, limit: 100 } }),
  markSent:      (id)     => API.patch(`/whatsapp/messages/${id}/sent`),
  dismiss:       (id)     => API.delete(`/whatsapp/messages/${id}`),
};

const TRIGGERS = [
  { key: 'notify_confirmed',  msgKey: 'msg_confirmed',  label: 'Order Confirmed',      icon: '✅' },
  { key: 'notify_packing',    msgKey: 'msg_packing',    label: 'Order Being Packed',   icon: '📦' },
  { key: 'notify_out',        msgKey: 'msg_out',        label: 'Out for Delivery',     icon: '🏍️' },
  { key: 'notify_delivered',  msgKey: 'msg_delivered',  label: 'Order Delivered',      icon: '🎉' },
  { key: 'notify_failed',     msgKey: 'msg_failed',     label: 'Delivery Failed',      icon: '❌' },
];

const WhatsAppSettings = () => {
  const [settings,  setSettings]  = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [toast,     setToast]     = useState(null);
  const [sending,   setSending]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, mRes] = await Promise.all([
        whatsappAPI.getSettings(),
        whatsappAPI.getMessages('pending'),
      ]);
      setSettings(sRes.data.settings);
      setMessages(mRes.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await whatsappAPI.updateSettings(settings);
      showToast('WhatsApp settings saved');
    } catch {
      showToast('Error saving settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (msg) => {
    /* Build wa.me link and open it */
    const phone = msg.phone?.replace(/\D/g, '');
    const intlPhone = phone?.startsWith('0') ? '233' + phone.slice(1) : phone;
    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg.message)}`;
    window.open(waUrl, '_blank');

    /* Mark as sent */
    try {
      setSending(msg.id);
      await whatsappAPI.markSent(msg.id);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    } catch {
      /* Non-critical */
    } finally {
      setSending(null);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await whatsappAPI.dismiss(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading WhatsApp settings…</span>
    </div>
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type}`} style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          minWidth: '260px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`tab-btn${activeTab === 'settings' ? ' active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Configuration
        </button>
        <button
          className={`tab-btn${activeTab === 'messages' ? ' active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          💬 Pending Messages
          {messages.length > 0 && (
            <span className="badge badge-red" style={{ marginLeft: '6px' }}>
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Settings tab ────────────────────────────────────── */}
      {activeTab === 'settings' && settings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* WhatsApp number + toggle */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              WhatsApp Configuration
            </h3>

            <div className="form-group">
              <label className="form-label">WhatsApp Business Number</label>
              <input
                className="form-input"
                value={settings.whatsapp_number || ''}
                onChange={e => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
                placeholder="e.g. 233244123456"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <p className="form-hint">
                International format without + (e.g. 233244123456 for 0244123456)
              </p>
            </div>

            {/* Master toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: '10px',
              background: settings.is_enabled ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${settings.is_enabled ? '#bbf7d0' : '#e5e5e3'}`,
              marginBottom: '4px',
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>
                  Enable Customer Notifications
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                  {settings.is_enabled
                    ? 'Messages will be queued when order status changes'
                    : 'No messages will be queued until enabled'}
                </p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, is_enabled: !s.is_enabled }))}
                style={{
                  width: '48px', height: '26px', borderRadius: '13px',
                  background: settings.is_enabled ? 'var(--accent, #22c55e)' : '#e2e8f0',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'white', position: 'absolute',
                  top: '3px', transition: 'left 0.2s',
                  left: settings.is_enabled ? '25px' : '3px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {!settings.whatsapp_number && (
              <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                ⚠️ Add your WhatsApp number above to start sending messages. You can save templates now and enable later.
              </div>
            )}
          </div>

          {/* Message triggers + templates */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              Message Templates
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 20px', lineHeight: '1.6' }}>
              Use <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>{'{name}'}</code>,{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>{'{order_number}'}</code>,{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>{'{amount}'}</code> as placeholders.
            </p>

            {TRIGGERS.map(t => (
              <div
                key={t.key}
                style={{
                  marginBottom: '20px', padding: '16px',
                  borderRadius: '10px', border: '1px solid var(--border)',
                  background: settings[t.key] ? '#fafafa' : '#f8f8f8',
                  opacity: settings[t.key] ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{t.icon}</span>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>{t.label}</p>
                  </div>
                  {/* Per-trigger toggle */}
                  <button
                    onClick={() => setSettings(s => ({ ...s, [t.key]: !s[t.key] }))}
                    style={{
                      width: '40px', height: '22px', borderRadius: '11px',
                      background: settings[t.key] ? 'var(--accent, #22c55e)' : '#e2e8f0',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: 'white', position: 'absolute',
                      top: '3px', transition: 'left 0.2s',
                      left: settings[t.key] ? '21px' : '3px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
                <textarea
                  className="form-input"
                  rows={2}
                  value={settings[t.msgKey] || ''}
                  onChange={e => setSettings(s => ({ ...s, [t.msgKey]: e.target.value }))}
                  disabled={!settings[t.key]}
                  style={{ fontSize: '13px', lineHeight: '1.5' }}
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ alignSelf: 'flex-start', minWidth: '160px' }}
          >
            {saving ? 'Saving…' : '💾 Save Settings'}
          </button>
        </div>
      )}

      {/* ── Pending messages tab ─────────────────────────────── */}
      {activeTab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {messages.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3>No pending messages</h3>
                <p>Messages will appear here when order statuses change.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="alert alert-info">
                <strong>💬 {messages.length} message{messages.length !== 1 ? 's' : ''} ready to send.</strong>
                {' '}Click "Send via WhatsApp" — it opens WhatsApp with the message pre-filled. Just hit Send.
              </div>

              {messages.map(msg => (
                <div
                  key={msg.id}
                  className="card"
                  style={{ borderLeft: '4px solid #25D366' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px' }}>{msg.customer_name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                          {msg.order_number}
                        </span>
                        <span className="badge badge-green" style={{ fontSize: '10px' }}>
                          {msg.trigger?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-3)' }}>
                        📱 {msg.phone}
                      </p>
                      {/* Editable message */}
                      <textarea
                        className="form-input"
                        rows={3}
                        value={msg.message}
                        onChange={e => setMessages(prev =>
                          prev.map(m => m.id === msg.id ? { ...m, message: e.target.value } : m)
                        )}
                        style={{ fontSize: '13px', lineHeight: '1.5' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleSend(msg)}
                        disabled={sending === msg.id}
                        style={{ background: '#25D366', whiteSpace: 'nowrap' }}
                      >
                        {sending === msg.id ? 'Opening…' : '📲 Send via WhatsApp'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismiss(msg.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsAppSettings;
