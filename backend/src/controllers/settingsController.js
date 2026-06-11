const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/stats
   Returns record counts so admin can see what they're about to reset.
   Accessible by: admin, super_admin
═══════════════════════════════════════════════════════════════ */
const getSystemStats = async (req, res) => {
  try {
    const [orders, cash, payments, customers, riders, products] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM orders"),
      pool.query("SELECT COUNT(*) FROM cash_logs"),
      pool.query("SELECT COUNT(*) FROM payments"),
      pool.query("SELECT COUNT(*) FROM customers"),
      pool.query("SELECT COUNT(*) FROM riders WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM products WHERE is_active = true"),
    ]);

    const pendingCash = await pool.query(
      "SELECT COUNT(*) FROM cash_logs WHERE status = 'pending'"
    );
    const pendingPayments = await pool.query(
      "SELECT COUNT(*) FROM payments WHERE status = 'pending'"
    );

    res.json({
      success: true,
      stats: {
        orders:           parseInt(orders.rows[0].count),
        cash_logs:        parseInt(cash.rows[0].count),
        payments:         parseInt(payments.rows[0].count),
        customers:        parseInt(customers.rows[0].count),
        riders:           parseInt(riders.rows[0].count),
        products:         parseInt(products.rows[0].count),
        pending_cash:     parseInt(pendingCash.rows[0].count),
        pending_payments: parseInt(pendingPayments.rows[0].count),
      },
    });
  } catch (error) {
    console.error('getSystemStats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/reset/notifications
   Clears pending-only cash log flags (marks all pending as verified).
   Does NOT delete any data.
   Accessible by: admin, super_admin
═══════════════════════════════════════════════════════════════ */
const resetNotifications = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark all pending cash logs as verified
    const cashResult = await client.query(
      `UPDATE cash_logs SET status = 'verified', verified_at = NOW()
       WHERE status = 'pending'`
    );

    // Mark all pending payments as verified
    const paymentResult = await client.query(
      `UPDATE payments
       SET status = 'verified', verified_by = $1, verified_at = NOW()
       WHERE status = 'pending'`,
      [req.user.id]
    );

    // Log the action
    await client.query(
      `INSERT INTO reset_logs (action, performed_by, details)
       VALUES ('reset_notifications', $1, $2)`,
      [
        req.user.id,
        JSON.stringify({
          cash_logs_cleared:     cashResult.rowCount,
          payments_cleared:      paymentResult.rowCount,
          performed_at:          new Date().toISOString(),
        }),
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'All pending notifications cleared',
      cleared: {
        cash_logs:  cashResult.rowCount,
        payments:   paymentResult.rowCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('resetNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/reset/counters
   Zeros out daily operational counters:
   - Deletes cash_logs older than today
   - Resets order statuses back to pending (keeps records)
   - Clears failed/returned orders
   Accessible by: admin, super_admin
═══════════════════════════════════════════════════════════════ */
const resetDailyCounters = async (req, res) => {
  const client = await pool.connect();
  try {
    const { confirm_text } = req.body;
    if (confirm_text !== 'RESET') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation text must be exactly "RESET"',
      });
    }

    await client.query('BEGIN');

    // Delete cash logs from previous days (keep today's)
    const cashDeleted = await client.query(
      `DELETE FROM cash_logs WHERE DATE(created_at) < CURRENT_DATE`
    );

    // Reset failed/returned order statuses to pending
    const ordersReset = await client.query(
      `UPDATE orders SET status = 'pending', updated_at = NOW()
       WHERE status IN ('failed', 'returned')`
    );

    // Clear payment failures — reset to pending
    const paymentsReset = await client.query(
      `UPDATE payments SET status = 'pending', updated_at = NOW()
       WHERE status = 'failed'`
    );

    // Log the action
    await client.query(
      `INSERT INTO reset_logs (action, performed_by, details)
       VALUES ('reset_daily_counters', $1, $2)`,
      [
        req.user.id,
        JSON.stringify({
          cash_logs_deleted:   cashDeleted.rowCount,
          orders_reset:        ordersReset.rowCount,
          payments_reset:      paymentsReset.rowCount,
          performed_at:        new Date().toISOString(),
        }),
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Daily counters reset successfully',
      summary: {
        cash_logs_deleted:  cashDeleted.rowCount,
        orders_reset:       ordersReset.rowCount,
        payments_reset:     paymentsReset.rowCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('resetDailyCounters error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/reset/archive
   DESTRUCTIVE — super_admin only.
   1. Creates archive snapshot of all operational data
   2. Deletes all orders, cash_logs, payments, deliveries, order_items
   3. Resets product stock is NOT touched (products stay)
   4. Customers and riders are NOT deleted
   Accessible by: super_admin ONLY
═══════════════════════════════════════════════════════════════ */
const archiveAndReset = async (req, res) => {
  const client = await pool.connect();
  try {
    const { confirm_text } = req.body;
    if (confirm_text !== 'ARCHIVE AND RESET') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation text must be exactly "ARCHIVE AND RESET"',
      });
    }

    // Double-check role on controller level (belt + braces)
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can perform a full archive and reset',
      });
    }

    await client.query('BEGIN');

    const archiveTag = `archive_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    /* ── 1. Snapshot counts before deletion ─────────────────── */
    const [orderCount, cashCount, paymentCount, deliveryCount] = await Promise.all([
      client.query('SELECT COUNT(*) FROM orders'),
      client.query('SELECT COUNT(*) FROM cash_logs'),
      client.query('SELECT COUNT(*) FROM payments'),
      client.query('SELECT COUNT(*) FROM deliveries'),
    ]);

    /* ── 2. Create archive tables if they don't exist ────────── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS archive_orders AS TABLE orders WITH NO DATA;
      ALTER TABLE archive_orders ADD COLUMN IF NOT EXISTS archive_tag TEXT;
      ALTER TABLE archive_orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS archive_cash_logs AS TABLE cash_logs WITH NO DATA;
      ALTER TABLE archive_cash_logs ADD COLUMN IF NOT EXISTS archive_tag TEXT;
      ALTER TABLE archive_cash_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS archive_payments AS TABLE payments WITH NO DATA;
      ALTER TABLE archive_payments ADD COLUMN IF NOT EXISTS archive_tag TEXT;
      ALTER TABLE archive_payments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();
    `);

    /* ── 3. Copy live data into archives ─────────────────────── */
    await client.query(`
      INSERT INTO archive_orders
      SELECT *, $1, NOW() FROM orders
    `, [archiveTag]);

    await client.query(`
      INSERT INTO archive_cash_logs
      SELECT *, $1, NOW() FROM cash_logs
    `, [archiveTag]);

    await client.query(`
      INSERT INTO archive_payments
      SELECT *, $1, NOW() FROM payments
    `, [archiveTag]);

    /* ── 4. Delete operational data (respecting FK order) ────── */
    await client.query('DELETE FROM cash_logs');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM deliveries');
    await client.query('DELETE FROM orders');

    /* ── 5. Reset rider availability ─────────────────────────── */
    await client.query(
      'UPDATE riders SET is_available = true, updated_at = NOW() WHERE is_active = true'
    );

    /* ── 6. Log the archive action ───────────────────────────── */
    await client.query(
      `INSERT INTO reset_logs (action, performed_by, details)
       VALUES ('archive_and_reset', $1, $2)`,
      [
        req.user.id,
        JSON.stringify({
          archive_tag,
          orders_archived:    parseInt(orderCount.rows[0].count),
          cash_archived:      parseInt(cashCount.rows[0].count),
          payments_archived:  parseInt(paymentCount.rows[0].count),
          deliveries_deleted: parseInt(deliveryCount.rows[0].count),
          performed_at:       new Date().toISOString(),
        }),
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Archive complete. All operational data has been archived and reset.',
      archive_tag,
      archived: {
        orders:    parseInt(orderCount.rows[0].count),
        cash_logs: parseInt(cashCount.rows[0].count),
        payments:  parseInt(paymentCount.rows[0].count),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('archiveAndReset error:', error);
    res.status(500).json({ success: false, message: 'Server error during archive' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/reset-logs
   Returns history of all reset actions.
   Accessible by: admin, super_admin
═══════════════════════════════════════════════════════════════ */
const getResetLogs = async (req, res) => {
  try {
    // Ensure reset_logs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reset_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        performed_by INTEGER REFERENCES users(id),
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `SELECT rl.*, u.name as performed_by_name, u.role as performed_by_role
       FROM reset_logs rl
       LEFT JOIN users u ON rl.performed_by = u.id
       ORDER BY rl.created_at DESC
       LIMIT 50`
    );

    res.json({ success: true, logs: result.rows });
  } catch (error) {
    console.error('getResetLogs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSystemStats,
  resetNotifications,
  resetDailyCounters,
  archiveAndReset,
  getResetLogs,
};
