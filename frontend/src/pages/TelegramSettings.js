import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';

const telegramAPI = {
  getSettings: ()       => API.get('/telegram/settings'),
  saveSettings: (data)  => API.post('/telegram/settings', data),
  testBot:     (data)   => API.post('/telegram/test', data),
  linkRider:   (id, data) => API.patch(`/telegram/riders/${id}/link`, data),
};

const TRIGGERS = [
  { key: 'notify_assigned',  msgKey: 'msg_assigned',  label: 'Delivery Assigned', icon: '🏍️',
    hint: 'Sent when a rider is assigned to an order' },
  { key: 'notify_picked_up', msgKey: 'msg_picked_up', label: 'Picked Up',         icon: '📦',
    hint: 'Sent when rider confirms pickup' },
  { key: 'notify_reminder',  msgKey: 'msg_reminder',  label: 'Reminder',          icon: '⏰',
    hint: 'Manual reminder for pending deliveries' },
];

const PLACEHOLDERS = [
  { tag: '{order_number}',    desc: 'Order number e.g. SW-20260610-001' },
  { tag: '{customer_name}',   desc: 'Customer name' },
  { tag: '{customer_phone}',  desc: 'Customer phone number' },
  { tag: '{delivery_address}',desc: 'Delivery address' },
  { tag: '{amount}',          desc: 'Order amount in GH₵' },
  { tag: '{payment_method}',  desc: 'Payment method' },
];

const TelegramSettings = ({ riders = [] }) => {
  const [settings, setSettings] = useState({
    bot_token: '',
    is_enabled: false,
    notify_assigned: true,
    notify_picked_up: true,
    notify_reminder: true,
    msg_assigned: '🏍️ New delivery assigned!\n\nOrder: {order_number}\nCustomer: {customer_name}\nPhone: {customer_phone}\nAddress: {delivery_address}\nAmount: GH₵ {amount}\nPayment: {payment_method}',
    msg_picked_up: '✅ Picked up confirmed for order {order_number}. Head to the delivery address now.',
    msg_reminder: '⏰ Reminder: Order {order_number} is still pending. Please confirm status.',
  });
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [toast,      setToast]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('config');
  const [linking,    setLinking]    = useState(null);
  const [linkForm,   setLinkForm]   = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await telegramAPI.getSettings();
      setSettings(res.data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await telegramAPI.saveSettings(settings);
      showToast('Telegram settings saved');
    } catch {
      showToast('Error saving settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testChatId.trim()) return showToast('Enter a chat ID to test', 'warning');
    try {
      setTesting(true);
      await telegramAPI.testBot({ chat_id: testChatId.trim() });
      showToast('Test message sent! Check Telegram.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Test failed', 'danger');
    } finally {
      setTesting(false);
    }
  };

  const handleLinkRider = async (riderId) => {
    const form = linkForm[riderId] || {};
    if (!form.telegram_chat_id) return showToast('Chat ID is required', 'warning');
    try {
      setLinking(riderId);
      await telegramAPI.linkRider(riderId, form);
      showToast('Rider linked! Welcome message sent.');
      setLinkForm(prev => ({ ...prev, [riderId]: {} }));
    } catch (err) {
      showToast(err.response?.data?.message || 'Error linking rider', 'danger');
    } finally {
      setLinking(null);
    }
  };

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Loading Telegram settings…</span>
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
        {[
          { key: 'config',  label: '⚙️ Configuration' },
          { key: 'riders',  label: '🏍️ Link Riders' },
          { key: 'messages',label: '💬 Message Templates' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Config tab ───────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* How to get a bot */}
          <div className="alert alert-info">
            <strong>📱 How to set up your Telegram Bot:</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: '18px', lineHeight: '1.8', fontSize: '13px' }}>
              <li>Open Telegram → search <strong>@BotFather</strong></li>
              <li>Send <code>/newbot</code></li>
              <li>Name it <strong>Shorewinds Delivery</strong></li>
              <li>Username: <strong>ShorewindsDeliveryBot</strong> (or any available)</li>
              <li>Copy the token BotFather gives you and paste it below</li>
            </ol>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
              Bot Configuration
            </h3>

            {/* Bot token */}
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <input
                className="form-input"
                type="password"
                value={settings.bot_token || ''}
                onChange={e => setSettings(s => ({ ...s, bot_token: e.target.value }))}
                placeholder="7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <p className="form-hint">
                Get this from @BotFather on Telegram. Keep it secret.
              </p>
            </div>

            {/* Master toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: '10px',
              background: settings.is_enabled ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${settings.is_enabled ? '#bbf7d0' : '#e5e5e3'}`,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>
                  Enable Telegram Notifications
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                  {settings.is_enabled
                    ? 'Riders will receive Telegram messages'
                    : 'No messages will be sent until enabled'}
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
                  background: 'white', position: 'absolute', top: '3px',
                  transition: 'left 0.2s',
                  left: settings.is_enabled ? '25px' : '3px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {/* Notification toggles */}
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-2)', margin: '0 0 10px' }}>
                Notify riders when:
              </p>
              {TRIGGERS.map(t => (
                <div
                  key={t.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--border-2)',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>
                      {t.icon} {t.label}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>{t.hint}</p>
                  </div>
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
                      background: 'white', position: 'absolute', top: '3px',
                      transition: 'left 0.2s',
                      left: settings[t.key] ? '21px' : '3px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Test bot */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>
              Test Your Bot
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 14px' }}>
              Send a test message to verify your bot token works. You need your Telegram Chat ID.
            </p>
            <div className="alert alert-info" style={{ marginBottom: '14px' }}>
              To get your Chat ID: message <strong>@userinfobot</strong> on Telegram — it replies with your ID.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                value={testChatId}
                onChange={e => setTestChatId(e.target.value)}
                placeholder="Your Telegram Chat ID e.g. 123456789"
                style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
              />
              <button
                className="btn btn-primary"
                onClick={handleTest}
                disabled={testing}
                style={{ flexShrink: 0 }}
              >
                {testing ? 'Sending…' : '📲 Send Test'}
              </button>
            </div>
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

      {/* ── Link Riders tab ──────────────────────────────────── */}
      {activeTab === 'riders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="alert alert-info">
            <strong>How riders get their Chat ID:</strong> Ask each rider to message <strong>@userinfobot</strong> on Telegram. It replies instantly with their Chat ID. They send it to you and you enter it below.
          </div>

          {riders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🏍️</div>
                <h3>No riders yet</h3>
                <p>Add riders first then link their Telegram here.</p>
              </div>
            </div>
          ) : riders.map(rider => (
            <div
              key={rider.id}
              className="card"
              style={{ borderLeft: `4px solid ${rider.telegram_chat_id ? '#22c55e' : '#e5e5e3'}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: rider.telegram_chat_id ? '#22c55e' : '#94a3b8',
                  color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: '700', fontSize: '14px', flexShrink: 0,
                }}>
                  {rider.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{rider.name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>{rider.phone}</p>
                </div>
                {rider.telegram_chat_id ? (
                  <span className="badge badge-green">✓ Linked</span>
                ) : (
                  <span className="badge badge-gray">Not linked</span>
                )}
              </div>

              {rider.telegram_chat_id ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
                  <div style={{ background: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>Chat ID: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{rider.telegram_chat_id}</span>
                  </div>
                  {rider.telegram_username && (
                    <div style={{ background: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>Username: </span>
                      <span style={{ fontWeight: '600' }}>@{rider.telegram_username}</span>
                    </div>
                  )}
                  {/* Allow re-linking */}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setLinkForm(prev => ({
                      ...prev,
                      [rider.id]: { telegram_chat_id: rider.telegram_chat_id, telegram_username: rider.telegram_username || '' }
                    }))}
                  >
                    ✎ Update
                  </button>
                </div>
              ) : null}

              {/* Link form — show for unlinked or when updating */}
              {(!rider.telegram_chat_id || linkForm[rider.id]) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, minWidth: '140px', fontFamily: 'var(--font-mono)' }}
                    placeholder="Telegram Chat ID e.g. 123456789"
                    value={linkForm[rider.id]?.telegram_chat_id || ''}
                    onChange={e => setLinkForm(prev => ({
                      ...prev,
                      [rider.id]: { ...prev[rider.id], telegram_chat_id: e.target.value }
                    }))}
                  />
                  <input
                    className="form-input"
                    style={{ flex: 1, minWidth: '120px' }}
                    placeholder="@username (optional)"
                    value={linkForm[rider.id]?.telegram_username || ''}
                    onChange={e => setLinkForm(prev => ({
                      ...prev,
                      [rider.id]: { ...prev[rider.id], telegram_username: e.target.value }
                    }))}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleLinkRider(rider.id)}
                    disabled={linking === rider.id}
                    style={{ flexShrink: 0 }}
                  >
                    {linking === rider.id ? 'Linking…' : '🔗 Link'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Message templates tab ────────────────────────────── */}
      {activeTab === 'messages' && settings && (

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Placeholders reference */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px' }}>
              Available Placeholders
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PLACEHOLDERS.map(p => (
                <div key={p.tag} style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                  <code style={{ fontWeight: '700', color: 'var(--navy)' }}>{p.tag}</code>
                  <span style={{ color: 'var(--text-3)', marginLeft: '6px' }}>{p.desc}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '10px 0 0' }}>
              Use <strong>&lt;b&gt;text&lt;/b&gt;</strong> for bold, <strong>\n</strong> for new line (HTML mode).
            </p>
          </div>

          {TRIGGERS.map(t => (
            <div key={t.key} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>{t.icon}</span>
                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>{t.label}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: '4px' }}>— {t.hint}</span>
              </div>
              <textarea
                className="form-input"
                rows={4}
                value={settings[t.msgKey] || ''}
                onChange={e => setSettings(s => ({ ...s, [t.msgKey]: e.target.value }))}
                style={{ fontSize: '13px', lineHeight: '1.6', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          ))}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ alignSelf: 'flex-start', minWidth: '160px' }}
          >
            {saving ? 'Saving…' : '💾 Save Templates'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TelegramSettings;
