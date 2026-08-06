const pool = require('../config/db');

const getCashLogs = async (req, res) => {
  try {
    const { rider_id, status, date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (rider_id) { conditions.push(`cl.rider_id = $${i++}`); values.push(rider_id); }
    if (status) { conditions.push(`cl.status = $${i++}`); values.push(status); }
    if (date) { conditions.push(`DATE(cl.created_at) = $${i++}`); values.push(date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cash_logs cl ${where}`, values
    );

    const result = await pool.query(
      `SELECT cl.*, r.name as rider_name, r.phone as rider_phone,
              o.order_number, u.name as verified_by_name,
              (SELECT id FROM cash_logs res WHERE res.resolves_log_id = cl.id ORDER BY res.created_at DESC LIMIT 1) as resolving_log_id,
              (SELECT amount FROM cash_logs res WHERE res.resolves_log_id = cl.id ORDER BY res.created_at DESC LIMIT 1) as resolving_log_amount,
              (SELECT status FROM cash_logs res WHERE res.resolves_log_id = cl.id ORDER BY res.created_at DESC LIMIT 1) as resolving_log_status
       FROM cash_logs cl
       LEFT JOIN riders r ON cl.rider_id = r.id
       LEFT JOIN orders o ON cl.order_id = o.id
       LEFT JOIN users u ON cl.verified_by = u.id
       ${where}
       ORDER BY cl.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      logs: result.rows,
    });
  } catch (error) {
    console.error('getCashLogs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createCashLog = async (req, res) => {
  try {
    const { rider_id, order_id, amount, notes, resolves_log_id } = req.body;
    let effectiveRiderId = rider_id;
    let effectiveOrderId = order_id;

    // If a rider is submitting this themselves, force rider_id to the
    // rider profile actually linked to their account — never trust a
    // rider_id passed in the request body for a rider caller, since
    // that would let one rider log (or "cover") cash under another
    // rider's name. Admins/managers/etc. keep passing rider_id
    // explicitly, since they're logging on someone's behalf.
    if (req.user?.role === 'rider') {
      const ownRider = await pool.query(`SELECT id FROM riders WHERE user_id = $1`, [req.user.id]);
      if (ownRider.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'No rider profile linked to your account' });
      }
      effectiveRiderId = ownRider.rows[0].id;
    }

    if (!effectiveRiderId || !amount) {
      return res.status(400).json({ success: false, message: 'Rider and amount are required' });
    }

    // If this log is meant to cover a specific dispute, validate that
    // dispute actually exists, is still disputed, and — critically —
    // belongs to the same rider. This is the theft-control boundary:
    // a rider (or anyone) must not be able to link their payment to
    // someone else's shortfall.
    if (resolves_log_id) {
      const target = await pool.query(
        `SELECT id, rider_id, order_id, status FROM cash_logs WHERE id = $1`,
        [resolves_log_id]
      );
      if (target.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'The dispute you are trying to resolve was not found' });
      }
      if (target.rows[0].status !== 'disputed') {
        return res.status(400).json({ success: false, message: 'That cash log is not currently disputed' });
      }
      if (String(target.rows[0].rider_id) !== String(effectiveRiderId)) {
        return res.status(403).json({ success: false, message: 'You can only submit against your own disputed collections' });
      }
      // Default order_id to the disputed log's order if none was passed
      if (!effectiveOrderId) effectiveOrderId = target.rows[0].order_id;
    }

    let status = 'pending';
    let finalNotes = notes || null;

    // If this cash log is tied to a specific order, check whether the
    // amount logged (combined with anything already logged for that
    // same order — e.g. a rider topping up a prior shortfall) actually
    // covers what the order is worth. If it falls short, auto-flag it
    // as disputed instead of waiting for someone to notice manually.
    // This does NOT skip admin review when things match — it only
    // catches shortfalls earlier. A matching amount still lands as
    // 'pending' and still needs an admin to click Verify.
    if (effectiveOrderId) {
      const orderResult = await pool.query(
        `SELECT total_amount FROM orders WHERE id = $1`,
        [effectiveOrderId]
      );
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const expected = parseFloat(orderResult.rows[0].total_amount);

      const priorResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as prior_total FROM cash_logs WHERE order_id = $1`,
        [effectiveOrderId]
      );
      const priorTotal = parseFloat(priorResult.rows[0].prior_total);
      const totalAfterThisLog = priorTotal + parseFloat(amount);

      if (totalAfterThisLog < expected) {
        const shortfall = (expected - totalAfterThisLog).toFixed(2);
        status = 'disputed';
        finalNotes = `${finalNotes ? finalNotes + ' | ' : ''}Auto-flagged: GHS ${shortfall} short of expected GHS ${expected.toFixed(2)} for this order`;
      }
    }

    const result = await pool.query(
      `INSERT INTO cash_logs (rider_id, order_id, amount, notes, status, resolves_log_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [effectiveRiderId, effectiveOrderId, amount, finalNotes, status, resolves_log_id || null]
    );

    res.status(201).json({
      success: true,
      message: status === 'disputed' ? 'Cash logged — short of expected amount, flagged as disputed' : 'Cash logged',
      log: result.rows[0],
    });
  } catch (error) {
    console.error('createCashLog error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyCashLog = async (req, res) => {
  try {
    const { id } = req.params;

    // customer_support gets verify access, but only for physical cash
    // they'd have directly witnessed themselves — COD is collected by a
    // different person (the rider), days later, so self-verifying it
    // wouldn't mean anything as an actual check. Every other allowed
    // role (super_admin/admin/manager/cashier) can verify either.
    if (req.user.role === 'customer_support') {
      const log = await pool.query(
        `SELECT o.payment_method FROM cash_logs cl
         LEFT JOIN orders o ON cl.order_id = o.id
         WHERE cl.id = $1`,
        [id]
      );
      if (log.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Cash log not found' });
      }
      if (log.rows[0].payment_method !== 'cash') {
        return res.status(403).json({
          success: false,
          message: 'Support staff can only verify physical cash sales — COD collections are verified by the finance team.',
        });
      }
    }

    const result = await pool.query(
      `UPDATE cash_logs SET status = 'verified', verified_at = NOW(), verified_by = $1
       WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.user?.id || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cash log not found or already verified' });
    }
    res.json({ success: true, message: 'Cash verified', log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const disputeCashLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await pool.query(
      `UPDATE cash_logs SET status = 'disputed', notes = COALESCE($1, notes)
       WHERE id = $2 RETURNING *`,
      [notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cash log not found' });
    }
    res.json({ success: true, message: 'Cash log marked as disputed', log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const resolveCashLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes, resolved_amount } = req.body;

    const result = await pool.query(
      `UPDATE cash_logs
       SET status = 'resolved',
           resolved_by = $1,
           resolved_at = NOW(),
           resolution_notes = COALESCE($2, resolution_notes),
           resolved_amount = $3
       WHERE id = $4 AND status = 'disputed'
       RETURNING *`,
      [req.user?.id || null, resolution_notes || null, resolved_amount || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cash log not found or not currently disputed' });
    }

    res.json({ success: true, message: 'Dispute resolved', log: result.rows[0] });
  } catch (error) {
    console.error('resolveCashLog error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Total orders today
    const ordersResult = await pool.query(
      `SELECT COUNT(*) as total_orders,
              SUM(total_amount) as total_revenue,
              COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
       FROM orders WHERE DATE(created_at) = $1`,
      [targetDate]
    );

    // Cash collected today
    const cashResult = await pool.query(
      `SELECT SUM(amount) as total_cash,
              COUNT(*) as total_logs,
              COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
              COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed
       FROM cash_logs WHERE DATE(created_at) = $1`,
      [targetDate]
    );

    // Per rider summary
    const riderResult = await pool.query(
      `SELECT r.name as rider_name, r.phone,
              COUNT(cl.id) as total_collections,
              SUM(cl.amount) as total_amount,
              COUNT(CASE WHEN cl.status = 'verified' THEN 1 END) as verified,
              COUNT(CASE WHEN cl.status = 'pending' THEN 1 END) as pending,
              COUNT(CASE WHEN cl.status = 'disputed' THEN 1 END) as disputed
       FROM riders r
       LEFT JOIN cash_logs cl ON r.id = cl.rider_id AND DATE(cl.created_at) = $1
       GROUP BY r.id, r.name, r.phone
       ORDER BY total_amount DESC NULLS LAST`,
      [targetDate]
    );

    // Payment method breakdown
    const paymentResult = await pool.query(
      `SELECT payment_method,
              COUNT(*) as count,
              SUM(total_amount) as total
       FROM orders WHERE DATE(created_at) = $1
       GROUP BY payment_method`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      report: {
        orders: ordersResult.rows[0],
        cash: cashResult.rows[0],
        riders: riderResult.rows,
        payment_breakdown: paymentResult.rows,
      },
    });
  } catch (error) {
    console.error('getDailyReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRiderReconciliation = async (req, res) => {
  try {
    const { rider_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Expected — orders delivered by this rider today
    const expectedResult = await pool.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) as expected_amount,
              COUNT(o.id) as total_orders
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       WHERE d.rider_id = $1
       AND DATE(d.delivered_at) = $2
       AND o.status = 'delivered'
       AND o.payment_method = 'cash'`,
      [rider_id, targetDate]
    );

    // Actual — cash logged by this rider today
    const actualResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as actual_amount,
              COUNT(*) as total_logs,
              COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified
       FROM cash_logs
       WHERE rider_id = $1 AND DATE(created_at) = $2`,
      [rider_id, targetDate]
    );

    const expected = parseFloat(expectedResult.rows[0].expected_amount);
    const actual = parseFloat(actualResult.rows[0].actual_amount);
    const shortage = expected - actual;

    res.json({
      success: true,
      date: targetDate,
      reconciliation: {
        expected_amount: expected,
        actual_amount: actual,
        shortage: shortage > 0 ? shortage : 0,
        surplus: shortage < 0 ? Math.abs(shortage) : 0,
        is_balanced: shortage === 0,
        orders: expectedResult.rows[0],
        collections: actualResult.rows[0],
      },
    });
  } catch (error) {
    console.error('getRiderReconciliation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getCashLogs,
  createCashLog,
  verifyCashLog,
  disputeCashLog,
  resolveCashLog,
  getDailyReport,
  getRiderReconciliation,
};
