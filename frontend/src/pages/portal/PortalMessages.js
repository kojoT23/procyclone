import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const chatAPI = {
  getStaff:         () => API.get('/chat/staff'),
  getConversations: () => API.get('/chat/conversations'),
  startConversation:(userId) => API.post('/chat/conversations', { other_user_id: userId }),
  getMessages:      (id) => API.get(`/chat/conversations/${id}/messages`),
  sendMessage:      (id, data) => API.post(`/chat/conversations/${id}/messages`, data),
  getUnread:        () => API.get('/chat/unread'),
};

const EMOJIS = ['😊','😂','❤️','👍','👎','😢','😮','😡','🙏','🔥','✅','❌','📦','💰','🏍️','📍','⏳','🎉','👋','💬'];

const roleColor = (role) => ({
  super_admin: '#ef4444', admin: '#f59e0b', manager: '#3b82f6',
  cashier: '#22c55e', dispatcher: '#8b5cf6', warehouse: '#14b8a6', rider: '#f97316',
}[role] || '#94a3b8');

const fmtTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
};

export default function PortalMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [staff, setStaff] = useState([]);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    setConversations([]);
    try {
      const res = await chatAPI.getConversations();
      setConversations(res.data.conversations || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user?.id]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await chatAPI.getUnread();
      setUnread(res.data.total_unread || 0);
    } catch (e) {}
  }, []);

  useEffect(() => {
    setConversations([]);
    setActiveConv(null);
    setMessages([]);
    fetchConversations();
    fetchUnread();
    const socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001', {
      auth: { token: localStorage.getItem('accessToken') },
    });
    socketRef.current = socket;
    socket.on('new_message', (msg) => {
      setActiveConv(prev => {
        if (prev && msg.conversation_id === prev.id) {
          setMessages(m => [...m, msg]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        return prev;
      });
      fetchConversations();
      fetchUnread();
    });
    return () => socket.disconnect();
  }, [fetchConversations, fetchUnread]);

  const openConversation = async (conv) => {
    setActiveConv(conv);
    setShowNewChat(false);
    setShowEmoji(false);
    try {
      const res = await chatAPI.getMessages(conv.id);
      setMessages(res.data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeConv) return;
    setSending(true);
    setShowEmoji(false);
    try {
      const res = await chatAPI.sendMessage(activeConv.id, { content: text.trim() });
      setMessages(prev => [...prev, res.data.message]);
      setText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      fetchConversations();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const insertEmoji = (emoji) => {
    setText(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const startNewChat = async (staffMember) => {
    try {
      const res = await chatAPI.startConversation(staffMember.id);
      if (res.data.success && res.data.conversation) {
        setShowNewChat(false);
        const convsRes = await chatAPI.getConversations();
        const convs = convsRes.data.conversations || [];
        setConversations(convs);
        const fullConv = convs.find(c => c.id === res.data.conversation.id);
        openConversation(fullConv || res.data.conversation);
      }
    } catch (e) { console.error(e); }
  };

  const loadStaff = async () => {
    try {
      const res = await chatAPI.getStaff();
      const allowed = ['super_admin', 'admin', 'manager', 'dispatcher'];
      setStaff((res.data.staff || []).filter(s => s.id !== user?.id && allowed.includes(s.role)));
      setShowNewChat(true);
    } catch (e) { console.error(e); }
  };

  const getOther = (conv) => {
    if (!conv) return { name: '?', role: 'admin' };
    if (conv.other_name) return { name: conv.other_name, role: conv.other_role || 'admin' };
    return { name: '...', role: 'admin' };
  };

  if (activeConv) {
    const other = getOther(activeConv);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <button onClick={() => { setActiveConv(null); setShowEmoji(false); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', padding: 0 }}>←</button>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: roleColor(other.role), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>
            {other.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{other.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{other.role?.replace('_', ' ')}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }} onClick={() => setShowEmoji(false)}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>No messages yet. Say hello! 👋</div>
          )}
          {messages.map(msg => {
            const isMine = String(msg.sender_id) === String(user?.id);
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', minWidth: '80px', padding: '10px 14px',
                  borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMine ? '#22c55e' : '#fff',
                  color: isMine ? '#fff' : '#1a1a18',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.4,
                }}>
                  <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{fmtTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {showEmoji && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', marginBottom: 8, boxShadow: '0 -2px 12px rgba(0,0,0,0.1)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => insertEmoji(e)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: '4px', borderRadius: 6 }}>
                {e}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #f3f4f6', flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => setShowEmoji(s => !s)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>😊</button>
          <input
            ref={inputRef}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }}
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            onFocus={() => setShowEmoji(false)}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: text.trim() ? '#22c55e' : '#e5e7eb',
              border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >➤</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Messages</h1>
          {unread > 0 && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{unread} unread</span>}
        </div>
        <button onClick={loadStaff} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + New Chat
        </button>
      </div>

      {showNewChat && (
        <>
          <div onClick={() => setShowNewChat(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', zIndex: 201, maxHeight: '60vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Start a conversation</h3>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '8px 0' }}>
              {staff.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>No staff available</p>}
              {staff.map(s => (
                <div key={s.id} onClick={() => startNewChat(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f8' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: roleColor(s.role), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    {s.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{s.role?.replace('_', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <h3 style={{ color: '#1a1a18', margin: '0 0 8px' }}>No messages yet</h3>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Tap + New Chat to message your dispatcher or manager.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {conversations.map(conv => {
            const other = getOther(conv);
            return (
              <div key={conv.id} onClick={() => openConversation(conv)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderRadius: 12, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: roleColor(other.role), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
                    {other.name?.charAt(0).toUpperCase()}
                  </div>
                  {conv.unread_count > 0 && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {conv.unread_count}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{other.name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{conv.last_message_at ? fmtTime(conv.last_message_at) : ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: conv.unread_count > 0 ? '#1a1a18' : '#6b7280', fontWeight: conv.unread_count > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.last_message || 'No messages yet'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
