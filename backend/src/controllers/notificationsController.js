const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   GET /api/notifications
   Pulls real-time alerts from existing tables.
   No separate notifications table needed.
═══════════════════════════════════════════════════════════════ */
const getNotifications = async (req, res) => {
  try {
    const notifications = [];

    /* ── 1. New orders in last 2 hours ───────────────────────── */
    const newOrders = await pool.query(`
      SELECT o.id, o.order_number, o.total_amount, o.created_at,
             c.name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.created_at >= NOW() - INTERVAL '2 hours'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    newOrders.rows.forEach(o => {
      notifications.push({
        id:      `order-${o.id}`,
        type:    'order',
        message: `New order ${o.order_number} from ${o.customer_name || 'Customer'} — GH₵ ${parseFloat(o.total_amount).toFixed(2)}`,
        time:    o.created_at,
        read:    false,
        path:    '/orders',
      });
    });

    /* ── 2. Cash disputes ────────────────────────────────────── */
    const disputes = await pool.query(`
      SELECT cl.id, cl.amount, cl.created_at, r.name as rider_name
      FROM cash_logs cl
      LEFT JOIN riders r ON cl.rider_id = r.id
      WHERE cl.status = 'disputed'
      ORDER BY cl.created_at DESC
      LIMIT 5
    `);
    disputes.rows.forEach(d => {
      notifications.push({
        id:      `dispute-${d.id}`,
        type:    'cash',
        message: `Cash dispute — ${d.rider_name || 'Rider'} · GH₵ ${parseFloat(d.amount).toFixed(2)}`,
        time:    d.created_at,
        read:    false,
        path:    '/cash',
      });
    });

    /* ── 3. Pending cash logs > 1 hour ───────────────────────── */
    const pendingCash = await pool.query(`
      SELECT cl.id, cl.amount, cl.created_at, r.name as rider_name
      FROM cash_logs cl
      LEFT JOIN riders r ON cl.rider_id = r.id
      WHERE cl.status = 'pending'
      AND cl.created_at <= NOW() - INTERVAL '1 hour'
      ORDER BY cl.created_at DESC
      LIMIT 3
    `);
    pendingCash.rows.forEach(p => {
      notifications.push({
        id:      `pending-cash-${p.id}`,
        type:    'cash',
        message: `Pending cash from ${p.rider_name || 'Rider'} · GH₵ ${parseFloat(p.amount).toFixed(2)} needs verification`,
        time:    p.created_at,
        read:    false,
        path:    '/cash',
      });
    });

    /* ── 4. Low stock products ───────────────────────────────── */
    const lowStock = await pool.query(`
      SELECT id, name, stock_quantity, low_stock_threshold
      FROM products
      WHERE is_active = true
      AND stock_quantity <= low_stock_threshold
      ORDER BY stock_quantity ASC
      LIMIT 5
    `);
    lowStock.rows.forEach(p => {
      notifications.push({
        id:      `stock-${p.id}`,
        type:    'stock',
        message: p.stock_quantity === 0
          ? `${p.name} is out of stock`
          : `${p.name} is low on stock — ${p.stock_quantity} left`,
        time:    new Date().toISOString(),
        read:    false,
        path:    '/inventory',
      });
    });

    /* ── 5. Failed deliveries today ──────────────────────────── */
    const failed = await pool.query(`
      SELECT o.id, o.order_number, o.created_at, c.name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'failed'
      AND DATE(o.created_at) = CURRENT_DATE
      ORDER BY o.created_at DESC
      LIMIT 3
    `);
    failed.rows.forEach(f => {
      notifications.push({
        id:      `failed-${f.id}`,
        type:    'order',
        message: `Order ${f.order_number} failed — ${f.customer_name || 'Customer'}`,
        time:    f.created_at,
        read:    false,
        path:    '/orders',
      });
    });

    /* ── Sort by time descending ─────────────────────────────── */
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      success: true,
      count:   notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getNotifications };
