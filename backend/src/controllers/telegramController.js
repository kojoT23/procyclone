const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   TELEGRAM SERVICE
   All functions are non-critical — errors are logged not thrown
═══════════════════════════════════════════════════════════════ */

/* ── Send a message via Telegram Bot API ─────────────────────── */
const sendTelegramMessage = async (chatId, message) => {
  try {
    const settingsRes = await pool.query('SELECT * FROM telegram_settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    if (!settings?.bot_token || !settings?.is_enabled) return;

    const url = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: 'HTML',
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    }
    return data;
  } catch (error) {
    console.error('sendTelegramMessage error:', error.message);
  }
};

/* ── Notify rider of new delivery assignment ─────────────────── */
const notifyRiderAssigned = async (riderId, order) => {
  try {
    const settingsRes = await pool.query('SELECT * FROM telegram_settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    if (!settings?.is_enabled || !settings?.notify_assigned) return;

    const riderRes = await pool.query(
      'SELECT telegram_chat_id FROM riders WHERE id = $1',
      [riderId]
    );
    const rider = riderRes.rows[0];
    if (!rider?.telegram_chat_id) return;

    const paymentLabel =
      order.payment_method === 'momo' ? '📱 MTN MoMo (Pre-paid)' :
      order.payment_method === 'cod'  ? '💵 Cash on Delivery' :
      order.payment_method === 'cash' ? '💵 Cash' :
      order.payment_method;

    const message = (settings.msg_assigned || '')
      .replace(/{order_number}/g,   order.order_number   || '')
      .replace(/{customer_name}/g,  order.customer_name  || '')
      .replace(/{customer_phone}/g, order.customer_phone || '')
      .replace(/{delivery_address}/g, order.delivery_address || '')
      .replace(/{amount}/g,         parseFloat(order.total_amount || 0).toFixed(2))
      .replace(/{payment_method}/g, paymentLabel);

    await sendTelegramMessage(rider.telegram_chat_id, message);
  } catch (error) {
    console.error('notifyRiderAssigned error:', error.message);
  }
};

/* ── Notify rider of picked up confirmation ──────────────────── */
const notifyRiderPickedUp = async (riderId, orderNumber) => {
  try {
    const settingsRes = await pool.query('SELECT * FROM telegram_settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    if (!settings?.is_enabled || !settings?.notify_picked_up) return;

    const riderRes = await pool.query(
      'SELECT telegram_chat_id FROM riders WHERE id = $1',
      [riderId]
    );
    const rider = riderRes.rows[0];
    if (!rider?.telegram_chat_id) return;

    const message = (settings.msg_picked_up || '')
      .replace(/{order_number}/g, orderNumber || '');

    await sendTelegramMessage(rider.telegram_chat_id, message);
  } catch (error) {
    console.error('notifyRiderPickedUp error:', error.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/telegram/settings
═══════════════════════════════════════════════════════════════ */
const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM telegram_settings WHERE id = 1');
    const settings = result.rows[0];
    /* Mask bot token for security — only show last 6 chars */
    if (settings?.bot_token) {
      settings.bot_token_masked = '••••••••••' + settings.bot_token.slice(-6);
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/telegram/settings
═══════════════════════════════════════════════════════════════ */
const updateSettings = async (req, res) => {
  try {
    const {
      bot_token, is_enabled,
      notify_assigned, notify_picked_up, notify_reminder,
      msg_assigned, msg_picked_up, msg_reminder,
    } = req.body;

    /* Only update bot_token if a new one is provided (not masked) */
    const tokenUpdate = bot_token && !bot_token.startsWith('••••')
      ? `bot_token = $1,`
      : '';
    const tokenValue = bot_token && !bot_token.startsWith('••••') ? bot_token : null;

    const result = await pool.query(
      `UPDATE telegram_settings SET
        ${tokenUpdate}
        is_enabled        = COALESCE($2, is_enabled),
        notify_assigned   = COALESCE($3, notify_assigned),
        notify_picked_up  = COALESCE($4, notify_picked_up),
        notify_reminder   = COALESCE($5, notify_reminder),
        msg_assigned      = COALESCE($6, msg_assigned),
        msg_picked_up     = COALESCE($7, msg_picked_up),
        msg_reminder      = COALESCE($8, msg_reminder),
        updated_at        = NOW()
       WHERE id = 1 RETURNING *`,
      [
        tokenValue || is_enabled,
        tokenValue ? is_enabled : notify_assigned,
        tokenValue ? notify_assigned : notify_picked_up,
        tokenValue ? notify_picked_up : notify_reminder,
        tokenValue ? notify_reminder : msg_assigned,
        tokenValue ? msg_assigned : msg_picked_up,
        tokenValue ? msg_picked_up : msg_reminder,
        tokenValue ? msg_reminder : null,
      ]
    );

    res.json({ success: true, message: 'Telegram settings saved', settings: result.rows[0] });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/settings  (simpler update — full replace)
═══════════════════════════════════════════════════════════════ */
const saveSettings = async (req, res) => {
  try {
    const {
      bot_token, is_enabled,
      notify_assigned, notify_picked_up, notify_reminder,
      msg_assigned, msg_picked_up, msg_reminder,
    } = req.body;

    /* Get current token if masked value sent */
    let finalToken = bot_token;
    if (!bot_token || bot_token.startsWith('••••')) {
      const cur = await pool.query('SELECT bot_token FROM telegram_settings WHERE id = 1');
      finalToken = cur.rows[0]?.bot_token || null;
    }

    await pool.query(
      `UPDATE telegram_settings SET
        bot_token         = COALESCE($1, bot_token),
        is_enabled        = $2,
        notify_assigned   = $3,
        notify_picked_up  = $4,
        notify_reminder   = $5,
        msg_assigned      = COALESCE($6, msg_assigned),
        msg_picked_up     = COALESCE($7, msg_picked_up),
        msg_reminder      = COALESCE($8, msg_reminder),
        updated_at        = NOW()
       WHERE id = 1`,
      [
        finalToken, is_enabled,
        notify_assigned, notify_picked_up, notify_reminder,
        msg_assigned, msg_picked_up, msg_reminder,
      ]
    );

    res.json({ success: true, message: 'Telegram settings saved' });
  } catch (error) {
    console.error('saveSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/test
   Send a test message to verify bot token works
═══════════════════════════════════════════════════════════════ */
const testBot = async (req, res) => {
  try {
    const { chat_id } = req.body;
    if (!chat_id) {
      return res.status(400).json({ success: false, message: 'chat_id is required' });
    }

    const settingsRes = await pool.query('SELECT bot_token FROM telegram_settings WHERE id = 1');
    const token = settingsRes.rows[0]?.bot_token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Bot token not configured' });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: '✅ <b>Shorewinds Bot Connected!</b>\n\nYour Telegram is linked to Shorewinds. You will now receive delivery notifications here.',
        parse_mode: 'HTML',
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      return res.status(400).json({ success: false, message: `Telegram error: ${data.description}` });
    }
    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/telegram/riders/:id/link
   Link a rider's Telegram chat ID
═══════════════════════════════════════════════════════════════ */
const linkRiderTelegram = async (req, res) => {
  try {
    const { id } = req.params;
    const { telegram_chat_id, telegram_username } = req.body;

    await pool.query(
      `UPDATE riders SET
        telegram_chat_id  = $1,
        telegram_username = $2,
        updated_at        = NOW()
       WHERE id = $3`,
      [telegram_chat_id || null, telegram_username || null, id]
    );

    /* Send welcome message if chat_id provided */
    if (telegram_chat_id) {
      const riderRes = await pool.query('SELECT name FROM riders WHERE id = $1', [id]);
      const riderName = riderRes.rows[0]?.name || 'Rider';
      await sendTelegramMessage(
        telegram_chat_id,
        `👋 <b>Hi ${riderName}!</b>\n\nYour Telegram has been linked to Shorewinds. You will now receive delivery assignments and updates here.\n\n🏍️ <b>Stay ready!</b>`
      );
    }

    res.json({ success: true, message: 'Telegram linked successfully' });
  } catch (error) {
    console.error('linkRiderTelegram error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings, saveSettings, testBot,
  linkRiderTelegram, sendTelegramMessage,
  notifyRiderAssigned, notifyRiderPickedUp,
};
