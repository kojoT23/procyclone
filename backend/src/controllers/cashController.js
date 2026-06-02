const pool = require('../config/db');

const getCashLogs = async (req, res) => {
  try {
    const { rider_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (rider_id) { conditions.push(`cl.rider_id = $${i++}`); values.push(rider_id); }
    if (status) { conditions.push(`cl.status = $${i++}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cash_logs cl ${where}`, values
    );

    const result = await pool.query(
      `SELECT cl.*, r.name as rider_name, r.phone as rider_phone,
              o.order_number, u.name as verified_by_name
       FROM cash_logs cl
       LEFT JOIN riders r ON cl.rider_id = r.id
       LEFT JOIN orders o ON cl.order_id = o.id
       LEFT JOIN users u ON cl.verified_at IS NOT NULL AND cl.rider_id = u.id
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
    const { rider_id, order_id, amount, notes } = req.body;
    if (!rider_id || !amount) {
      return res.status(400).json({ success: false, message: 'Rider and amount are required' });
    }

    const result = await pool.query(
      `INSERT INTO cash_logs (rider_id, order_id, amount, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [rider_id, order_id, amount, notes]
    );

    res.status(201).json({ success: true, message: 'Cash logged', log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyCashLog = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE cash_logs SET status = 'verified', verified_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
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
  getDailyReport,
  getRiderReconciliation,
};
