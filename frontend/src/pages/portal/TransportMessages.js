import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// Identical contract to the desktop Chat.js — same REST endpoints, same
// socket event names — so this plugs into the existing backend with zero
// backend changes. Sending happens over the socket (message:send), same
// as desktop; chatAPI.sendMessage exists but desktop doesn't actually use
// it either, kept here only for parity.
const chatAPI = {
  getSettings:      ()           => API.get('/chat/settings'),
  getStaff:         (params)     => API.get('/chat/staff', { params }),
  getConversations: ()           => API.get('/chat/conversations'),
  startConversation:(data)       => API.post('/chat/conversations', data),
  getMessages:      (id, params) => API.get(`/chat/conversations/${id}/messages`, { params }),
};

const roleColor = (role) => ({
  super_admin: '#ef4444', admin: '#f59e0b', manager: '#3b82f6',
  cashier: '#22c55e', dispatcher: '#8b5cf6', warehouse: '#14b8a6', rider: '#f97316',
  customer_support: '#7c3aed',
}[role] || '#94a3b8');

const fmtTime = (date) => {
  const d = new Date(date);
  const diff = Date.now() - d;
  if (diff < 86400000) return d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString('en-GH', { weekday: 'short' });
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
};

const Avatar = ({ name, role, size = 40, online }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: '50%', background: roleColor(role),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.4,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
    {online !== undefined && (
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: size * 0.3, height: size * 0.3,
        borderRadius: '50%', background: online ? '#22c55e' : '#94a3b8', border: '2px solid #fff',
      }} />
    )}
  </div>
);

const TransportMessages = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [view, setView] = useState('list'); // 'list' | 'thread' | 'staff'
  const [chatEnabled, setChatEnabled] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  /* ── Socket connection — identical setup to desktop Chat.js ───── */
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001', {
      auth: { userId: user?.id, token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('user:online', ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId])));
    socket.on('user:offline', ({ userId }) => setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; }));

    socket.on('message:new', (msg) => {
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.temp && m.sender_id === msg.sender_id && m.content === msg.content));
        if (filtered.find(m => m.id === msg.id)) return filtered;
        return [...filtered, msg];
      });
      setConversations(prev => prev.map(c =>
        c.id === msg.conversation_id ? { ...c, last_message: msg.content, last_message_at: msg.created_at } : c
      ));
    });

    socket.on('conversation:updated', ({ conversationId, last_message, last_message_at }) => {
      setConversations(prev => prev.map(c =>
        c.id === conversationId
          ? { ...c, last_message, last_message_at, unread_count: (parseInt(c.unread_count) || 0) + 1 }
          : c
      ).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    });

    socket.on('typing:start', ({ userId: uid }) => { if (uid !== user?.id) setTyping(true); });
    socket.on('typing:stop', ({ userId: uid }) => { if (uid !== user?.id) setTyping(false); });
    socket.on('messages:seen', () => {
      setMessages(prev => prev.map(m => m.sender_id === user?.id ? { ...m, is_read: true } : m));
    });
    socket.on('chat:disabled', () => setChatEnabled(false));

    return () => socket.disconnect();
  }, [user?.id]);

  /* ── Initial fetch ─────────────────────────────────────────── */
  const fetchInitial = useCallback(async () => {
    try {
      const [settingsRes, convsRes, staffRes] = await Promise.all([
        chatAPI.getSettings(), chatAPI.getConversations(), chatAPI.getStaff(),
      ]);
      setChatEnabled(settingsRes.data.settings?.is_enabled ?? true);
      setConversations(convsRes.data.conversations || []);
      setStaff(staffRes.data.staff || []);
    } catch (err) {
      console.error('fetchInitial error:', err);
    }
  }, []);
  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  const loadMessages = useCallback(async (convId) => {
    setLoadingMsgs(true);
    try {
      const res = await chatAPI.getMessages(convId, { limit: 50 });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('loadMessages error:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const openConversation = useCallback(async (conv) => {
    if (activeConv) socketRef.current?.emit('conversation:leave', { conversationId: activeConv.id });
    setActiveConv(conv);
    setMessages([]);
    setTyping(false);
    setView('thread');
    socketRef.current?.emit('conversation:join', { conversationId: conv.id });
    await loadMessages(conv.id);
    socketRef.current?.emit('messages:read', { conversationId: conv.id });
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [activeConv, loadMessages]);

  const startConversation = useCallback(async (staffMember) => {
    try {
      const res = await chatAPI.startConversation({ other_user_id: staffMember.id });
      const conv = {
        ...res.data.conversation,
        other_id: staffMember.id, other_name: staffMember.name, other_role: staffMember.role,
        other_last_login: staffMember.last_login, unread_count: 0,
      };
      setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev]);
      await openConversation(conv);
    } catch (err) {
      console.error('startConversation error:', err);
    }
  }, [openConversation]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !activeConv || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    const tempMsg = {
      id: Date.now(), conversation_id: activeConv.id, sender_id: user?.id,
      sender_name: user?.name, sender_role: user?.role, content,
      created_at: new Date().toISOString(), is_read: false, temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    socketRef.current?.emit('message:send', { conversationId: activeConv.id, content });
    socketRef.current?.emit('typing:stop', { conversationId: activeConv.id });
    setSending(false);
  }, [input, activeConv, sending, user]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!activeConv) return;
    socketRef.current?.emit('typing:start', { conversationId: activeConv.id });
    if (typingTimeout) clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => socketRef.current?.emit('typing:stop', { conversationId: activeConv.id }), 2000));
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const totalUnread = conversations.reduce((s, c) => s + (parseInt(c.unread_count) || 0), 0);

  // Guards against the one thing I can't verify without the backend chat
  // controller: whether getConversations() actually includes other_id on
  // every row. If it's ever missing, this omits the dot (Avatar treats
  // `undefined` as "don't show status") instead of falsely rendering it
  // gray/offline.
  const isOnline = (id) => (id === undefined || id === null) ? undefined : onlineUsers.has(id);

  /* ══════════════════════════ THREAD VIEW ══════════════════════ */
  if (view === 'thread' && activeConv) {
    return (
      // Full-screen takeover, same pattern real chat apps use when a
      // conversation opens — deliberately NOT trying to fit inside
      // TransportLayout's padded content area (16px/16px/80px, asymmetric
      // because of the fixed bottom nav). Fighting that with negative
      // margins and a guessed calc() height is fragile; covering the
      // whole viewport sidesteps it entirely. This also correctly hides
      // TransportLayout's own header and bottom nav while a thread is
      // open, which is the right behavior anyway.
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, height: '100vh',
        background: '#f9f9f8', zIndex: 300, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1a1a18', padding: 0 }}>←</button>
          <Avatar name={activeConv.other_name} role={activeConv.other_role} size={34} online={isOnline(activeConv.other_id)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{activeConv.other_name}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>
              {typing ? 'typing…' : isOnline(activeConv.other_id) ? 'online' : activeConv.other_role?.replace('_', ' ')}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f9f9f8' }}>
          {loadingMsgs ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>No messages yet — say hello 👋</div>
          ) : messages.map(msg => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%' }}>
                  <div style={{
                    padding: '9px 13px', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMine ? '#1a1a18' : '#fff', color: isMine ? '#fff' : '#1a1a18',
                    fontSize: 13.5, lineHeight: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    opacity: msg.temp ? 0.7 : 1, wordBreak: 'break-word',
                  }}>
                    {msg.is_deleted ? <em style={{ opacity: 0.6 }}>This message was deleted</em> : msg.content}
                  </div>
                  {isMine && (
                    <p style={{ margin: '2px 4px 0', fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
                      {msg.temp ? '⏳' : msg.is_read ? '✓✓' : '✓'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {typing && (
            <div style={{ alignSelf: 'flex-start', background: '#fff', padding: '9px 13px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af' }} />)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {chatEnabled ? (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fff', borderTop: '1px solid #f3f4f6', flexShrink: 0, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message…"
              rows={1}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #e5e7eb', fontSize: 13.5, resize: 'none', maxHeight: 90, boxSizing: 'border-box' }}
            />
            <button onClick={handleSend} disabled={!input.trim()}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: input.trim() ? '#1a1a18' : '#e5e7eb', color: '#fff', flexShrink: 0, cursor: input.trim() ? 'pointer' : 'default', fontSize: 16 }}>
              ➤
            </button>
          </div>
        ) : (
          <div style={{ padding: 14, textAlign: 'center', color: '#9ca3af', fontSize: 12, background: '#fff', borderTop: '1px solid #f3f4f6' }}>Chat is currently disabled</div>
        )}
      </div>
    );
  }

  /* ══════════════════════════ STAFF DIRECTORY ══════════════════ */
  if (view === 'staff') {
    return (
      <div style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1a1a18', padding: 0 }}>←</button>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a18', margin: 0 }}>New Message</h1>
        </div>
        <input
          type="text"
          value={staffSearch}
          onChange={e => setStaffSearch(e.target.value)}
          placeholder="Search by name…"
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 12, boxSizing: 'border-box',
          }}
        />
        {(() => {
          const filtered = staff.filter(s =>
            s.name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
            s.role?.toLowerCase().includes(staffSearch.toLowerCase())
          );
          if (staff.length === 0) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No staff available</p>;
          if (filtered.length === 0) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No match for "{staffSearch}"</p>;
          return filtered.map(s => (
            <div key={s.id} onClick={() => startConversation(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
              <Avatar name={s.name} role={s.role} online={isOnline(s.id)} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>{s.role?.replace('_', ' ')}</div>
              </div>
            </div>
          ));
        })()}
      </div>
    );
  }

  /* ══════════════════════════ CONVERSATION LIST ═════════════════ */
  return (
    <div style={{ paddingBottom: 24, position: 'relative', minHeight: '60vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: 0 }}>
          Messages {totalUnread > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#ef4444', borderRadius: 10, padding: '1px 8px', marginLeft: 6 }}>{totalUnread}</span>}
        </h1>
      </div>

      {conversations.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '50px 16px' }}>
          No conversations yet.<br />Tap the button below to message a colleague.
        </div>
      ) : (
        conversations.map(conv => (
          <div key={conv.id} onClick={() => openConversation(conv)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: '#fff', borderRadius: 10, marginBottom: 6 }}>
            <Avatar name={conv.other_name} role={conv.other_role} online={isOnline(conv.other_id)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{conv.other_name}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{conv.last_message_at ? fmtTime(conv.last_message_at) : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  {conv.last_message || 'No messages yet'}
                </span>
                {parseInt(conv.unread_count) > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#22c55e', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <button onClick={() => { setStaffSearch(''); setView('staff'); }}
        style={{
          position: 'fixed', bottom: 78, right: 20, width: 52, height: 52, borderRadius: '50%',
          background: '#22c55e', color: '#fff', border: 'none', fontSize: 24, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(34,197,94,0.4)', zIndex: 90,
        }}>
        ✎
      </button>
    </div>
  );
};

export default TransportMessages;
