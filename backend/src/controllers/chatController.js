const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/settings
═══════════════════════════════════════════════════════════════ */
const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chat_settings WHERE id = 1');
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/chat/settings  (super_admin only)
═══════════════════════════════════════════════════════════════ */
const updateSettings = async (req, res) => {
  try {
    const { is_enabled } = req.body;
    await pool.query(
      'UPDATE chat_settings SET is_enabled = $1, updated_at = NOW() WHERE id = 1',
      [is_enabled]
    );
    res.json({ success: true, message: `Chat ${is_enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/staff
   Returns all active staff for the staff directory
═══════════════════════════════════════════════════════════════ */
const getStaff = async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT id, name, email, role, phone, last_login
      FROM users
      WHERE is_active = true AND id != $1
    `;
    const values = [req.user.id];

    if (search) {
      query += ` AND (name ILIKE $2 OR email ILIKE $2 OR role ILIKE $2)`;
      values.push(`%${search}%`);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, values);
    res.json({ success: true, staff: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/conversations
   Returns all conversations for current user with unread counts
═══════════════════════════════════════════════════════════════ */
const getConversations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        c.id,
        c.last_message,
        c.last_message_at,
        -- Other participant info
        CASE WHEN c.participant1 = $1 THEN u2.id ELSE u1.id END as other_id,
        CASE WHEN c.participant1 = $1 THEN u2.name ELSE u1.name END as other_name,
        CASE WHEN c.participant1 = $1 THEN u2.role ELSE u1.role END as other_role,
        CASE WHEN c.participant1 = $1 THEN u2.last_login ELSE u1.last_login END as other_last_login,
        -- Unread count
        (
          SELECT COUNT(*) FROM messages m
          LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
          WHERE m.conversation_id = c.id
          AND m.sender_id != $1
          AND mr.id IS NULL
        ) as unread_count
       FROM conversations c
       JOIN users u1 ON c.participant1 = u1.id
       JOIN users u2 ON c.participant2 = u2.id
       WHERE c.participant1 = $1 OR c.participant2 = $1
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error('getConversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/chat/conversations
   Start or get existing conversation with another user
═══════════════════════════════════════════════════════════════ */
const getOrCreateConversation = async (req, res) => {
  try {
    const { other_user_id } = req.body;
    const userId = req.user.id;

    /* Ensure consistent ordering */
    const p1 = Math.min(userId, other_user_id);
    const p2 = Math.max(userId, other_user_id);

    /* Get or create */
    let result = await pool.query(
      'SELECT * FROM conversations WHERE participant1 = $1 AND participant2 = $2',
      [p1, p2]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO conversations (participant1, participant2) VALUES ($1, $2) RETURNING *',
        [p1, p2]
      );
    }

    res.json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    console.error('getOrCreateConversation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/conversations/:id/messages
   Returns paginated messages for a conversation
═══════════════════════════════════════════════════════════════ */
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit = 30 } = req.query;

    /* Verify user is part of this conversation */
    const conv = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1 = $2 OR participant2 = $2)',
      [id, req.user.id]
    );
    if (conv.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let query = `
      SELECT m.*, u.name as sender_name, u.role as sender_role,
             EXISTS(
               SELECT 1 FROM message_reads mr
               WHERE mr.message_id = m.id AND mr.user_id != m.sender_id
             ) as is_read
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const values = [id];
    let i = 2;

    if (before) {
      query += ` AND m.created_at < $${i++}`;
      values.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${i}`;
    values.push(limit);

    const result = await pool.query(query, values);

    /* Mark messages as read */
    const unreadIds = result.rows
      .filter(m => m.sender_id !== req.user.id)
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await pool.query(
        `INSERT INTO message_reads (message_id, user_id)
         SELECT unnest($1::int[]), $2
         ON CONFLICT DO NOTHING`,
        [unreadIds, req.user.id]
      );
    }

    res.json({
      success: true,
      messages: result.rows.reverse(),
      has_more: result.rows.length === parseInt(limit),
    });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/chat/conversations/:id/messages
   Send a message
═══════════════════════════════════════════════════════════════ */
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    /* Verify user is part of conversation */
    const conv = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1 = $2 OR participant2 = $2)',
      [id, req.user.id]
    );
    if (conv.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    /* Insert message */
    const msgResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, req.user.id, content.trim()]
    );

    /* Update conversation last_message */
    await pool.query(
      `UPDATE conversations SET last_message = $1, last_message_at = NOW() WHERE id = $2`,
      [content.trim().substring(0, 100), id]
    );

    const message = {
      ...msgResult.rows[0],
      sender_name: req.user.name,
      sender_role: req.user.role,
    };

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/unread
   Total unread count for current user
═══════════════════════════════════════════════════════════════ */
const getUnreadCount = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
       WHERE (c.participant1 = $1 OR c.participant2 = $1)
       AND m.sender_id != $1
       AND mr.id IS NULL`,
      [req.user.id]
    );
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/chat/search
   Search messages across all conversations
═══════════════════════════════════════════════════════════════ */
const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.conversation_id,
              u.name as sender_name
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN users u ON m.sender_id = u.id
       WHERE (c.participant1 = $1 OR c.participant2 = $1)
       AND m.content ILIKE $2
       ORDER BY m.created_at DESC
       LIMIT 20`,
      [req.user.id, `%${q}%`]
    );
    res.json({ success: true, results: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings, updateSettings, getStaff,
  getConversations, getOrCreateConversation,
  getMessages, sendMessage, getUnreadCount, searchMessages,
};

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/chat/messages/:id
   Edit a message (sender only)
═══════════════════════════════════════════════════════════════ */
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' });

    const result = await pool.query(
      `UPDATE messages SET
        original_content = COALESCE(original_content, content),
        content = $1,
        edited_at = NOW()
       WHERE id = $2 AND sender_id = $3 AND is_deleted = false
       RETURNING *`,
      [content.trim(), id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found or not yours' });
    }
    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/chat/messages/:id
   Soft delete a message (sender only)
═══════════════════════════════════════════════════════════════ */
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE messages SET is_deleted = true, content = 'This message was deleted'
       WHERE id = $1 AND sender_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found or not yours' });
    }
    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/chat/messages/:id/react
   Add or remove a reaction
═══════════════════════════════════════════════════════════════ */
const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji required' });

    /* Toggle — if exists remove, if not add */
    const existing = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, req.user.id, emoji]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, req.user.id, emoji]
      );
    }

    /* Return updated reactions for this message */
    const reactions = await pool.query(
      `SELECT emoji, COUNT(*) as count,
              array_agg(u.name) as users
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1
       GROUP BY emoji`,
      [id]
    );

    res.json({ success: true, reactions: reactions.rows, removed: existing.rows.length > 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/chat/broadcast
   Send message to ALL active staff (super_admin only)
═══════════════════════════════════════════════════════════════ */
const broadcastMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' });

    /* Get all active staff except sender */
    const staff = await pool.query(
      'SELECT id FROM users WHERE is_active = true AND id != $1',
      [req.user.id]
    );

    let sent = 0;
    for (const member of staff.rows) {
      /* Get or create conversation */
      const p1 = Math.min(req.user.id, member.id);
      const p2 = Math.max(req.user.id, member.id);

      let conv = await pool.query(
        'SELECT id FROM conversations WHERE participant1 = $1 AND participant2 = $2',
        [p1, p2]
      );

      if (conv.rows.length === 0) {
        conv = await pool.query(
          'INSERT INTO conversations (participant1, participant2) VALUES ($1, $2) RETURNING id',
          [p1, p2]
        );
      }

      const convId = conv.rows[0].id;

      await pool.query(
        'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)',
        [convId, req.user.id, content.trim()]
      );

      await pool.query(
        'UPDATE conversations SET last_message = $1, last_message_at = NOW() WHERE id = $2',
        [content.trim().substring(0, 100), convId]
      );

      sent++;
    }

    /* Log broadcast */
    await pool.query(
      'INSERT INTO broadcasts (sender_id, content, sent_to) VALUES ($1, $2, $3)',
      [req.user.id, content.trim(), sent]
    );

    res.json({ success: true, message: `Broadcast sent to ${sent} staff members`, sent });
  } catch (error) {
    console.error('broadcastMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings, updateSettings, getStaff,
  getConversations, getOrCreateConversation,
  getMessages, sendMessage, getUnreadCount, searchMessages,
  editMessage, deleteMessage, reactToMessage, broadcastMessage,
};
