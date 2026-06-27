const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   GET /api/whatsapp/settings
═══════════════════════════════════════════════════════════════ */
const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM whatsapp_settings WHERE id = 1');
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/whatsapp/settings
═══════════════════════════════════════════════════════════════ */
const updateSettings = async (req, res) => {
  try {
    const {
      whatsapp_number,
      is_enabled,
      notify_confirmed, notify_packing, notify_out,
      notify_delivered, notify_failed,
      msg_confirmed, msg_packing, msg_out,
      msg_delivered, msg_failed,
    } = req.body;

    const result = await pool.query(
      `UPDATE whatsapp_settings SET
        whatsapp_number   = COALESCE($1,  whatsapp_number),
        is_enabled        = COALESCE($2,  is_enabled),
        notify_confirmed  = COALESCE($3,  notify_confirmed),
        notify_packing    = COALESCE($4,  notify_packing),
        notify_out        = COALESCE($5,  notify_out),
        notify_delivered  = COALESCE($6,  notify_delivered),
        notify_failed     = COALESCE($7,  notify_failed),
        msg_confirmed     = COALESCE($8,  msg_confirmed),
        msg_packing       = COALESCE($9,  msg_packing),
        msg_out           = COALESCE($10, msg_out),
        msg_delivered     = COALESCE($11, msg_delivered),
        msg_failed        = COALESCE($12, msg_failed),
        updated_at        = NOW()
       WHERE id = 1 RETURNING *`,
      [
        whatsapp_number, is_enabled,
        notify_confirmed, notify_packing, notify_out,
        notify_delivered, notify_failed,
        msg_confirmed, msg_packing, msg_out,
        msg_delivered, msg_failed,
      ]
    );

    res.json({ success: true, message: 'Settings saved', settings: result.rows[0] });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/whatsapp/queue
   Called by orderController when status changes
   Queues a customer message
═══════════════════════════════════════════════════════════════ */
const queueMessage = async (order, trigger) => {
  try {
    /* Get WhatsApp settings */
    const settingsRes = await pool.query('SELECT * FROM whatsapp_settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    if (!settings) return;

    /* Check if this trigger is enabled */
    const triggerMap = {
      confirmed: settings.notify_confirmed,
      packing:   settings.notify_packing,
      out_for_delivery: settings.notify_out,
      delivered: settings.notify_delivered,
      failed:    settings.notify_failed,
    };
    if (!triggerMap[trigger]) return;

    /* Build message from template */
    const templateMap = {
      confirmed:        settings.msg_confirmed,
      packing:          settings.msg_packing,
      out_for_delivery: settings.msg_out,
      delivered:        settings.msg_delivered,
      failed:           settings.msg_failed,
    };
    const template = templateMap[trigger];
    if (!template) return;

    const message = template
      .replace(/{name}/g,         order.customer_name || 'Customer')
      .replace(/{order_number}/g, order.order_number  || '')
      .replace(/{amount}/g,       parseFloat(order.total_amount || 0).toFixed(2));

    /* Check for existing pending message for this order+trigger */
    const existing = await pool.query(
      `SELECT id FROM customer_messages
       WHERE order_id = $1 AND trigger = $2 AND status = 'pending'`,
      [order.id, trigger]
    );
    if (existing.rows.length > 0) return; /* Already queued */

    /* Insert */
    await pool.query(
      `INSERT INTO customer_messages
        (order_id, customer_id, phone, customer_name, order_number, message, trigger)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        order.id,
        order.customer_id,
        order.customer_phone,
        order.customer_name,
        order.order_number,
        message,
        trigger,
      ]
    );
  } catch (error) {
    console.error('queueMessage error:', error);
    /* Non-critical — don't throw */
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/whatsapp/messages
   Returns pending + recent messages
═══════════════════════════════════════════════════════════════ */
const getMessages = async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;
    const result = await pool.query(
      `SELECT * FROM customer_messages
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/whatsapp/messages/:id/sent
   Mark a message as sent
═══════════════════════════════════════════════════════════════ */
const markSent = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE customer_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ success: true, message: 'Marked as sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/whatsapp/messages/:id
   Dismiss a message
═══════════════════════════════════════════════════════════════ */
const dismissMessage = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE customer_messages SET status = 'dismissed' WHERE id = $1`,
      [id]
    );
    res.json({ success: true, message: 'Message dismissed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings, updateSettings, queueMessage,
  getMessages, markSent, dismissMessage,
};
