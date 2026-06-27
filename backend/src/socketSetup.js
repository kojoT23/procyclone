const pool = require('./config/db');

const setupSocket = (io) => {
  const onlineUsers = new Map();

  io.on('connection', async (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return socket.disconnect();

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.join(`user:${userId}`);
    io.emit('user:online', { userId: parseInt(userId), online: true });

    socket.on('conversation:join', async ({ conversationId }) => {
      try {
        const result = await pool.query(
          'SELECT id FROM conversations WHERE id = $1 AND (participant1 = $2 OR participant2 = $2)',
          [conversationId, userId]
        );
        if (result.rows.length > 0) socket.join(`conv:${conversationId}`);
      } catch (err) { console.error('conversation:join error:', err.message); }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('message:send', async ({ conversationId, content }) => {
      try {
        if (!content?.trim()) return;

        const settings = await pool.query('SELECT is_enabled FROM chat_settings WHERE id = 1');
        if (!settings.rows[0]?.is_enabled) {
          socket.emit('chat:disabled', { message: 'Chat has been disabled by admin' });
          return;
        }

        const conv = await pool.query(
          'SELECT * FROM conversations WHERE id = $1 AND (participant1 = $2 OR participant2 = $2)',
          [conversationId, userId]
        );
        if (conv.rows.length === 0) return;

        const msgResult = await pool.query(
          'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [conversationId, userId, content.trim()]
        );

        await pool.query(
          'UPDATE conversations SET last_message = $1, last_message_at = NOW() WHERE id = $2',
          [content.trim().substring(0, 100), conversationId]
        );

        const userRes = await pool.query('SELECT name, role FROM users WHERE id = $1', [userId]);
        const message = {
          ...msgResult.rows[0],
          sender_name: userRes.rows[0]?.name,
          sender_role: userRes.rows[0]?.role,
          is_read: false,
        };

        io.to(`conv:${conversationId}`).emit('message:new', message);

        const other = conv.rows[0].participant1 === parseInt(userId)
          ? conv.rows[0].participant2
          : conv.rows[0].participant1;

        io.to(`user:${other}`).emit('conversation:updated', {
          conversationId,
          last_message: content.trim().substring(0, 100),
          last_message_at: new Date().toISOString(),
          sender_name: userRes.rows[0]?.name,
        });
      } catch (err) {
        console.error('message:send error:', err.message);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId: parseInt(userId), conversationId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId: parseInt(userId), conversationId });
    });

    socket.on('messages:read', async ({ conversationId }) => {
      try {
        const unread = await pool.query(
          `SELECT m.id FROM messages m
           LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
           WHERE m.conversation_id = $2 AND m.sender_id != $1 AND mr.id IS NULL`,
          [userId, conversationId]
        );
        if (unread.rows.length > 0) {
          await pool.query(
            `INSERT INTO message_reads (message_id, user_id)
             SELECT unnest($1::int[]), $2 ON CONFLICT DO NOTHING`,
            [unread.rows.map(r => r.id), userId]
          );
          socket.to(`conv:${conversationId}`).emit('messages:seen', { conversationId, readBy: parseInt(userId) });
        }
      } catch (err) { console.error('messages:read error:', err.message); }
    });

    /* ── Edit message ───────────────────────────────────────── */
    socket.on('message:edit', async ({ messageId, content }) => {
      try {
        const result = await pool.query(
          `UPDATE messages SET
            original_content = COALESCE(original_content, content),
            content = $1, edited_at = NOW()
           WHERE id = $2 AND sender_id = $3 AND is_deleted = false
           RETURNING *, conversation_id`,
          [content.trim(), messageId, userId]
        );
        if (result.rows.length > 0) {
          io.to(`conv:${result.rows[0].conversation_id}`).emit('message:edited', result.rows[0]);
        }
      } catch (err) { console.error('message:edit error:', err.message); }
    });

    /* ── Delete message ──────────────────────────────────────── */
    socket.on('message:delete', async ({ messageId }) => {
      try {
        const result = await pool.query(
          `UPDATE messages SET is_deleted = true, content = 'This message was deleted'
           WHERE id = $1 AND sender_id = $2
           RETURNING *, conversation_id`,
          [messageId, userId]
        );
        if (result.rows.length > 0) {
          io.to(`conv:${result.rows[0].conversation_id}`).emit('message:deleted', { messageId, conversation_id: result.rows[0].conversation_id });
        }
      } catch (err) { console.error('message:delete error:', err.message); }
    });

    /* ── React to message ────────────────────────────────────── */
    socket.on('message:react', async ({ messageId, emoji, conversationId }) => {
      try {
        const existing = await pool.query(
          'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [messageId, userId, emoji]
        );
        if (existing.rows.length > 0) {
          await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
        } else {
          await pool.query(
            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [messageId, userId, emoji]
          );
        }
        const reactions = await pool.query(
          `SELECT emoji, COUNT(*) as count, array_agg(u.name) as users
           FROM message_reactions mr
           JOIN users u ON mr.user_id = u.id
           WHERE mr.message_id = $1 GROUP BY emoji`,
          [messageId]
        );
        io.to(`conv:${conversationId}`).emit('message:reactions', { messageId, reactions: reactions.rows });
      } catch (err) { console.error('message:react error:', err.message); }
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user:offline', { userId: parseInt(userId), online: false });
        }
      }
    });
  });
};

module.exports = setupSocket;
