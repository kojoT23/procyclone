import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ─── API helpers ─────────────────────────────────────────────── */
const chatAPI = {
  getSettings:      ()           => API.get('/chat/settings'),
  getStaff:         (params)     => API.get('/chat/staff', { params }),
  getConversations: ()           => API.get('/chat/conversations'),
  startConversation:(data)       => API.post('/chat/conversations', data),
  getMessages:      (id, params) => API.get(`/chat/conversations/${id}/messages`, { params }),
  sendMessage:      (id, data)   => API.post(`/chat/conversations/${id}/messages`, data),
  getUnread:        ()           => API.get('/chat/unread'),
  search:           (q)          => API.get('/chat/search', { params: { q } }),
};

/* ─── Role colors ─────────────────────────────────────────────── */
const roleColor = (role) => ({
  super_admin: '#ef4444', admin: '#f59e0b', manager: '#3b82f6',
  cashier: '#22c55e', dispatcher: '#8b5cf6', warehouse: '#14b8a6', rider: '#f97316',
}[role] || '#94a3b8');

/* ─── Time format ─────────────────────────────────────────────── */
const fmtTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString('en-GH', { weekday: 'short' });
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
};

/* ─── Avatar ──────────────────────────────────────────────────── */
const Avatar = ({ name, role, size = 36, online }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: roleColor(role),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700',
      fontSize: size * 0.38,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
    {online !== undefined && (
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: size * 0.28, height: size * 0.28,
        borderRadius: '50%',
        background: online ? '#22c55e' : '#94a3b8',
        border: '2px solid white',
      }} />
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   CHAT PAGE
═══════════════════════════════════════════════════════════════ */
const Chat = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  /* ── State ─────────────────────────────────────────────────── */
  const [chatEnabled,    setChatEnabled]    = useState(true);
  const [conversations,  setConversations]  = useState([]);
  const [staff,          setStaff]          = useState([]);
  const [onlineUsers,    setOnlineUsers]    = useState(new Set());
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [input,          setInput]          = useState('');
  const [sending,        setSending]        = useState(false);
  const [editingMsg,     setEditingMsg]     = useState(null);
  const [editInput,      setEditInput]      = useState('');
  const [replyTo,        setReplyTo]        = useState(null);
  const [msgMenu,        setMsgMenu]        = useState(null);
  const [broadcasting,   setBroadcasting]   = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [showBroadcast,  setShowBroadcast]  = useState(false);
  const [typing,         setTyping]         = useState(false);
  const [typingTimeout,  setTypingTimeout]  = useState(null);
  const [search,         setSearch]         = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [panel,          setPanel]          = useState('conversations'); // conversations | staff | search
  const [isMobileOpen,   setIsMobileOpen]   = useState(false);

  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const inputRef       = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';

  /* ── Connect Socket.io ─────────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001', {
      auth: { userId: user?.id, token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('disconnect', () => console.log('Socket disconnected'));

    /* Online/offline */
    socket.on('user:online',  ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId])));
    socket.on('user:offline', ({ userId }) => setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; }));

    /* New message */
    socket.on('message:new', (msg) => {
      setMessages(prev => {
        /* Remove any temp message with same content + sender */
        const filtered = prev.filter(m => !(m.temp && m.sender_id === msg.sender_id && m.content === msg.content));
        /* Avoid duplicates */
        if (filtered.find(m => m.id === msg.id)) return filtered;
        return [...filtered, msg];
      });
      setConversations(prev => prev.map(c =>
        c.id === msg.conversation_id
          ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
          : c
      ));
    });

    /* Conversation updated (other user sent message) */
    socket.on('conversation:updated', ({ conversationId, last_message, last_message_at }) => {
      setConversations(prev => prev.map(c =>
        c.id === conversationId
          ? { ...c, last_message, last_message_at, unread_count: (parseInt(c.unread_count) || 0) + 1 }
          : c
      ).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    });

    /* Typing */
    socket.on('typing:start', ({ userId: uid }) => {
      if (uid !== user?.id) setTyping(true);
    });
    socket.on('typing:stop', ({ userId: uid }) => {
      if (uid !== user?.id) setTyping(false);
    });

    /* Seen */
    socket.on('messages:seen', () => {
      setMessages(prev => prev.map(m =>
        m.sender_id === user?.id ? { ...m, is_read: true } : m
      ));
    });

    /* Chat disabled */
    socket.on('chat:disabled', () => setChatEnabled(false));
    socket.on('message:edited', (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited_at: msg.edited_at } : m));
    });
    socket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted' } : m));
    });
    socket.on('message:reactions', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    return () => socket.disconnect();
  }, [user?.id]);

  /* ── Fetch initial data ────────────────────────────────────── */
  const fetchInitial = useCallback(async () => {
    try {
      const [settingsRes, convsRes, staffRes] = await Promise.all([
        chatAPI.getSettings(),
        chatAPI.getConversations(),
        chatAPI.getStaff(),
      ]);
      setChatEnabled(settingsRes.data.settings?.is_enabled ?? true);
      setConversations(convsRes.data.conversations || []);
      setStaff(staffRes.data.staff || []);
    } catch (err) {
      console.error('Chat fetchInitial error:', err);
    }
  }, []);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  /* ── Load messages for active conversation ─────────────────── */
  const loadMessages = useCallback(async (convId, before = null) => {
    try {
      setLoadingMsgs(true);
      const params = { limit: 30 };
      if (before) params.before = before;
      const res = await chatAPI.getMessages(convId, params);
      const newMsgs = res.data.messages || [];
      if (before) {
        setMessages(prev => [...newMsgs, ...prev]);
      } else {
        setMessages(newMsgs);
      }
      setHasMore(res.data.has_more);
    } catch (err) {
      console.error('loadMessages error:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  /* ── Open conversation ─────────────────────────────────────── */
  const openConversation = useCallback(async (conv) => {
    /* Leave previous room */
    if (activeConv) {
      socketRef.current?.emit('conversation:leave', { conversationId: activeConv.id });
    }

    setActiveConv(conv);
    setMessages([]);
    setTyping(false);
    setIsMobileOpen(true);

    /* Join new room */
    socketRef.current?.emit('conversation:join', { conversationId: conv.id });

    /* Load messages */
    await loadMessages(conv.id);

    /* Mark as read */
    socketRef.current?.emit('messages:read', { conversationId: conv.id });
    setConversations(prev => prev.map(c =>
      c.id === conv.id ? { ...c, unread_count: 0 } : c
    ));

    /* Focus input */
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConv, loadMessages]);

  /* ── Start conversation with staff member ──────────────────── */
  const startConversation = useCallback(async (staffMember) => {
    try {
      const res = await chatAPI.startConversation({ other_user_id: staffMember.id });
      const conv = {
        ...res.data.conversation,
        other_id:         staffMember.id,
        other_name:       staffMember.name,
        other_role:       staffMember.role,
        other_last_login: staffMember.last_login,
        unread_count:     0,
      };

      /* Add to conversations if not already there */
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id);
        if (exists) return prev;
        return [conv, ...prev];
      });

      setPanel('conversations');
      await openConversation(conv);
    } catch (err) {
      console.error('startConversation error:', err);
    }
  }, [openConversation]);

  /* ── Send message ──────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConv || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    /* Optimistic update */
    const tempMsg = {
      id: Date.now(),
      conversation_id: activeConv.id,
      sender_id: user?.id,
      sender_name: user?.name,
      sender_role: user?.role,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
      temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      /* Send via socket for real-time */
      socketRef.current?.emit('message:send', {
        conversationId: activeConv.id,
        content,
      });
      /* Stop typing */
      socketRef.current?.emit('typing:stop', { conversationId: activeConv.id });
    } catch (err) {
      console.error('send error:', err);
    } finally {
      setSending(false);
    }
  }, [input, activeConv, sending, user]);

  const handleEdit = async () => {
    if (!editInput.trim() || !editingMsg) return;
    socketRef.current?.emit('message:edit', { messageId: editingMsg.id, content: editInput.trim() });
    setEditingMsg(null); setEditInput('');
  };
  const handleDelete = (msg) => {
    if (!window.confirm('Delete this message?')) return;
    socketRef.current?.emit('message:delete', { messageId: msg.id });
    setMsgMenu(null);
  };
  const handleReact = (msg, emoji) => {
    const convId = msg.conversation_id || activeConv?.id;
    socketRef.current?.emit('message:react', { messageId: msg.id, emoji, conversationId: convId });
    /* Optimistic update */
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const existing = (m.reactions || []).find(r => r.emoji === emoji);
      if (existing) {
        return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0) };
      }
      return { ...m, reactions: [...(m.reactions || []), { emoji, count: 1, users: ['You'] }] };
    }));
  };
  const handleBroadcast = async () => {
    if (!broadcastInput.trim()) return;
    try {
      setBroadcasting(true);
      const res = await API.post('/chat/broadcast', { content: broadcastInput.trim() });
      alert(res.data.message);
      setBroadcastInput(''); setShowBroadcast(false);
    } catch (err) { alert(err.response?.data?.message || 'Broadcast failed'); }
    finally { setBroadcasting(false); }
  };

  /* ── Typing indicator ──────────────────────────────────────── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!activeConv) return;
    socketRef.current?.emit('typing:start', { conversationId: activeConv.id });
    if (typingTimeout) clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: activeConv.id });
    }, 2000));
  };

  /* ── Send on Enter ─────────────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Load more messages ────────────────────────────────────── */
  const loadMore = () => {
    if (!activeConv || !hasMore || loadingMsgs) return;
    const oldest = messages[0]?.created_at;
    loadMessages(activeConv.id, oldest);
  };

  /* ── Search ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await chatAPI.search(search);
        setSearchResults(res.data.results || []);
      } catch {}
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Scroll to bottom ──────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Toggle chat (super admin) ─────────────────────────────── */
  const toggleChat = async () => {
    try {
      await API.put('/chat/settings', { is_enabled: !chatEnabled });
      setChatEnabled(v => !v);
    } catch {}
  };

  /* ── Total unread ──────────────────────────────────────────── */
  const totalUnread = conversations.reduce((s, c) => s + (parseInt(c.unread_count) || 0), 0);

  /* ── Filter conversations/staff ────────────────────────────── */
  const filteredConvs = conversations.filter(c =>
    !search || c.other_name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStaff = staff.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.role?.toLowerCase().includes(search.toLowerCase())
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="chat-container" style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', minHeight: '500px' }}>

      {/* ── Left Panel ──────────────────────────────────────── */}
      <div style={{
        width: '320px', flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}
        className={`chat-left-panel${isMobileOpen ? ' hidden' : ''}`}
      >
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Messages</h2>
              {totalUnread > 0 && (
                <span style={{ background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px' }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {/* Super admin toggle */}
              {isSuperAdmin && (
                <button
                  onClick={toggleChat}
                  style={{
                    fontSize: '11px', fontWeight: '700', padding: '4px 10px',
                    borderRadius: '20px', border: 'none', cursor: 'pointer',
                    background: chatEnabled ? '#dcfce7' : '#fee2e2',
                    color: chatEnabled ? '#15803d' : '#dc2626',
                  }}
                  title={chatEnabled ? 'Disable chat' : 'Enable chat'}
                >
                  {chatEnabled ? '● Live' : '○ Off'}
                </button>
              )}
              {/* New chat button */}
              <button
                onClick={() => setPanel(p => p === 'staff' ? 'conversations' : 'staff')}
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: panel === 'staff' ? 'var(--navy)' : 'var(--bg-2)',
                  border: 'none', cursor: 'pointer', fontSize: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: panel === 'staff' ? 'white' : 'var(--text-2)',
                }}
                title="New conversation"
              >
                ✎
              </button>
              {isSuperAdmin && (
                <button onClick={() => setShowBroadcast(true)}
                  style={{ width:'30px',height:'30px',borderRadius:'50%',background:'#fef3c7',border:'none',cursor:'pointer',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center' }}
                  title="Broadcast to all staff">📢</button>
              )}
            </div>
          </div>

          {/* Search */}
          <input
            className="form-input"
            placeholder="Search messages or staff…"
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setPanel('search'); else setPanel('conversations'); }}
            style={{ fontSize: '13px', padding: '8px 12px' }}
          />
        </div>

        {/* Panel tabs */}
        {!search && (
          <div style={{ display: 'flex', padding: '8px 12px', gap: '4px', borderBottom: '1px solid var(--border-2)' }}>
            {[
              { key: 'conversations', label: 'Chats' },
              { key: 'staff',         label: 'Staff' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setPanel(t.key)}
                style={{
                  flex: 1, padding: '6px', border: 'none', cursor: 'pointer',
                  borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  fontFamily: 'var(--font)',
                  background: panel === t.key ? 'var(--navy)' : 'transparent',
                  color: panel === t.key ? 'white' : 'var(--text-3)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Disabled notice */}
          {!chatEnabled && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔇</div>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
                Chat is currently disabled
                {isSuperAdmin && ' — click "Off" to enable'}
              </p>
            </div>
          )}

          {/* Search results */}
          {panel === 'search' && (
            <div>
              {searching && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>Searching…</div>}
              {searchResults.map(r => (
                <div
                  key={r.id}
                  style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', cursor: 'pointer' }}
                  onClick={() => {
                    const conv = conversations.find(c => c.id === r.conversation_id);
                    if (conv) openConversation(conv);
                    setSearch('');
                    setPanel('conversations');
                  }}
                >
                  <p style={{ margin: '0 0 2px', fontSize: '12px', color: 'var(--text-3)' }}>{r.sender_name}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>
                    {r.content.length > 60 ? r.content.substring(0, 60) + '…' : r.content}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-3)' }}>{fmtTime(r.created_at)}</p>
                </div>
              ))}
              {!searching && searchResults.length === 0 && search.length >= 2 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  No messages found for "{search}"
                </div>
              )}
            </div>
          )}

          {/* Conversations */}
          {panel === 'conversations' && filteredConvs.map(conv => {
            const isActive = activeConv?.id === conv.id;
            const isOnline = onlineUsers.has(conv.other_id);
            return (
              <div
                key={conv.id}
                onClick={() => openConversation(conv)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', cursor: 'pointer',
                  background: isActive ? '#f0fdf4' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  borderBottom: '1px solid var(--border-2)',
                  transition: 'background 0.12s',
                }}
              >
                <Avatar name={conv.other_name} role={conv.other_role} online={isOnline} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontWeight: conv.unread_count > 0 ? '700' : '600', fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {conv.other_name}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0, marginLeft: '4px' }}>
                      {conv.last_message_at ? fmtTime(conv.last_message_at) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: conv.unread_count > 0 ? 'var(--text-2)' : 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px', fontWeight: conv.unread_count > 0 ? '600' : '400' }}>
                      {conv.last_message || 'Start a conversation'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span style={{ background: 'var(--accent)', color: 'white', fontSize: '10px', fontWeight: '700', minWidth: '18px', height: '18px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {panel === 'conversations' && filteredConvs.length === 0 && !search && (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>💬</div>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 8px' }}>No conversations yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>Click ✎ to start chatting with a staff member</p>
            </div>
          )}

          {/* Staff directory */}
          {panel === 'staff' && filteredStaff.map(s => {
            const isOnline = onlineUsers.has(s.id);
            return (
              <div
                key={s.id}
                onClick={() => startConversation(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-2)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar name={s.name} role={s.role} online={isOnline} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: roleColor(s.role), textTransform: 'capitalize', fontWeight: '500' }}>
                    {s.role?.replace('_', ' ')}
                    {isOnline && <span style={{ color: '#22c55e', marginLeft: '6px' }}>● Online</span>}
                  </p>
                </div>
                <span style={{ fontSize: '18px', color: 'var(--text-3)' }}>›</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel — Message Thread ─────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#fafaf9', minWidth: 0,
      }}>
        {!activeConv ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>💬</div>
            <p style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-2)', margin: '0 0 6px' }}>
              Select a conversation
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Choose from your chats or start a new one
            </p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              {/* Back button — mobile */}
              <button
                onClick={() => { setIsMobileOpen(false); setActiveConv(null); }}
                className="chat-back-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-2)', padding: '0 4px', display: 'none' }}
              >
                ‹
              </button>
              <Avatar
                name={activeConv.other_name}
                role={activeConv.other_role}
                size={38}
                online={onlineUsers.has(activeConv.other_id)}
              />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: 'var(--text)' }}>
                  {activeConv.other_name}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: onlineUsers.has(activeConv.other_id) ? '#22c55e' : 'var(--text-3)', fontWeight: '500' }}>
                  {onlineUsers.has(activeConv.other_id) ? '● Online' : 'Offline'}
                  {typing && <span style={{ color: 'var(--text-3)', marginLeft: '8px' }}>typing…</span>}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>

              {/* Load more */}
              {hasMore && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMsgs}
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  >
                    {loadingMsgs ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMine = msg.sender_id === user?.id;
                const prevMsg = messages[i - 1];
                const showSender = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                const showTime = !prevMsg || new Date(msg.created_at) - new Date(prevMsg.created_at) > 300000;

                return (
                  <React.Fragment key={msg.id}>
                    {showTime && (
                      <div style={{ textAlign: 'center', margin: '12px 0 4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-2)', padding: '2px 10px', borderRadius: '20px' }}>
                          {fmtTime(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      flexDirection: isMine ? 'row-reverse' : 'row',
                      alignItems: 'flex-end', gap: '8px',
                      marginBottom: '2px',
                      overflow: 'visible',
                      position: 'relative',
                    }}>
                      {!isMine && showSender && (
                        <Avatar name={msg.sender_name} role={msg.sender_role} size={28} />
                      )}
                      {!isMine && !showSender && <div style={{ width: 28 }} />}

                      <div style={{ maxWidth: '65%', minWidth: 0, overflow: 'visible' }}>
                        {showSender && !isMine && (
                          <p style={{ margin: '0 0 2px 4px', fontSize: '11px', color: roleColor(msg.sender_role), fontWeight: '600' }}>
                            {msg.sender_name}
                          </p>
                        )}
                        <div style={{ position:'relative', overflow: 'visible', paddingTop: msgMenu === msg.id ? '30px' : '0', marginTop: msgMenu === msg.id ? '-30px' : '0' }}
                        onMouseEnter={() => !msg.is_deleted && setMsgMenu(msg.id)}
                        onMouseLeave={() => setMsgMenu(null)}
                      >
                        {msgMenu === msg.id && !msg.is_deleted && (
                          <div style={{ position:'absolute',bottom:'calc(100% - 2px)',paddingBottom:'6px',[isMine?'right':'left']:0,display:'flex',gap:'4px',background:'white',border:'1px solid var(--border)',borderRadius:'20px',padding:'4px 8px 4px 8px',boxShadow:'var(--shadow-md)',zIndex:20,whiteSpace:'nowrap' }}>
                            {['👍','❤️','😂','😮','😢'].map(emoji => (
                              <button key={emoji} onClick={() => handleReact(msg, emoji)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'14px',padding:'2px' }}>{emoji}</button>
                            ))}
                            <button onClick={() => setReplyTo(msg)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'13px',padding:'2px 4px',color:'var(--text-2)' }} title="Reply">↩</button>
                            {isMine && <button onClick={() => { setEditingMsg(msg); setEditInput(msg.content); setMsgMenu(null); }} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'13px',padding:'2px 4px',color:'var(--text-2)' }} title="Edit">✎</button>}
                            {isMine && <button onClick={() => handleDelete(msg)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'13px',padding:'2px 4px',color:'#ef4444' }} title="Delete">🗑</button>}
                          </div>
                        )}
                      <div style={{
                          padding: '9px 13px',
                          minWidth: '80px',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMine ? 'var(--navy)' : 'white',
                          color: isMine ? 'white' : 'var(--text)',
                          fontSize: '13.5px', lineHeight: '1.5',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                          opacity: msg.temp ? 0.7 : 1,
                        }}>
                          {msg.content}
                        </div>
                        {isMine && (
                          <p style={{ margin: '2px 4px 0', fontSize: '10px', color: 'var(--text-3)', textAlign: 'right' }}>
                            {msg.temp ? '⏳' : msg.is_read ? '✓✓' : '✓'}
                          </p>
                        )}
                        {msg.edited_at && !msg.is_deleted && (
                          <p style={{ margin:'1px 4px 0',fontSize:'10px',color:'var(--text-3)',textAlign:isMine?'right':'left' }}>edited</p>
                        )}
                        {msg.reactions?.length > 0 && (
                          <div style={{ display:'flex',gap:'4px',flexWrap:'wrap',marginTop:'4px' }}>
                            {msg.reactions.map(r => (
                              <button key={r.emoji} onClick={() => handleReact(msg, r.emoji)} title={r.users?.join(', ')} style={{ background:'white',border:'1px solid var(--border)',borderRadius:'20px',padding:'2px 7px',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'3px' }}>
                                {r.emoji} <span style={{ fontSize:'11px',color:'var(--text-2)' }}>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Typing bubble */}
              {typing && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <Avatar name={activeConv.other_name} role={activeConv.other_role} size={28} />
                  <div style={{ background: 'white', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', animation: `bounce 1s ease ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {chatEnabled ? (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                {replyTo && (
                  <div style={{ padding:'8px 16px',background:'#f0fdf4',borderBottom:'1px solid var(--border-2)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <div>
                      <p style={{ margin:0,fontSize:'11px',color:'var(--accent)',fontWeight:'600' }}>Replying to {replyTo.sender_name}</p>
                      <p style={{ margin:0,fontSize:'12px',color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'300px' }}>{replyTo.content}</p>
                    </div>
                    <button onClick={() => setReplyTo(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'16px' }}>✕</button>
                  </div>
                )}
                <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
                    borderRadius: '22px', fontSize: '13.5px', fontFamily: 'var(--font)',
                    resize: 'none', outline: 'none', lineHeight: '1.5',
                    maxHeight: '120px', overflowY: 'auto',
                    background: 'var(--bg)',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--navy)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: input.trim() ? 'var(--navy)' : 'var(--bg-2)',
                    border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.15s',
                    fontSize: '16px',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={input.trim() ? 'white' : '#94a3b8'}>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
              </div>
            ) : (
              <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                Chat is currently disabled
              </div>
            )}
          </>
        )}
      </div>

      {/* Typing animation */}
      {showBroadcast && (
        <div className="modal-overlay" onClick={() => setShowBroadcast(false)}>
          <div className="modal" style={{ maxWidth:'460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📢 Broadcast to All Staff</h2>
              <button className="modal-close" onClick={() => setShowBroadcast(false)}>✕</button>
            </div>
            <div className="alert alert-warning" style={{ marginBottom:'16px' }}>
              This message will be sent to ALL active staff members simultaneously.
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input" rows={4} value={broadcastInput} onChange={e => setBroadcastInput(e.target.value)} placeholder="Type your announcement…" autoFocus />
            </div>
            <div style={{ display:'flex',gap:'8px' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowBroadcast(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleBroadcast} disabled={broadcasting || !broadcastInput.trim()}>
                {broadcasting ? 'Sending…' : '📢 Send to All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        .chat-left-panel {
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 768px) {
          .chat-container {
            position: relative;
            height: calc(100vh - 130px) !important;
          }
          .chat-left-panel {
            width: 100% !important;
            position: absolute;
            z-index: 10;
            height: 100%;
            top: 0; left: 0;
          }
          .chat-left-panel.hidden {
            display: none !important;
          }
          .chat-back-btn {
            display: flex !important;
          }
          .chat-right-panel {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Chat;
