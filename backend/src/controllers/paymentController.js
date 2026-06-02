const pool = require('../config/db');

const getPayments = async (req, res) => {
  try {
    const { status, method, order_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`p.status = $${i++}`); values.push(status); }
    if (method) { conditions.push(`p.method = $${i++}`); values.push(method); }
    if (order_id) { conditions.push(`p.order_id = $${i++}`); values.push(order_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM payments p ${where}`, values
    );

    const result = await pool.query(
      `SELECT p.*, o.order_number, c.name as customer_name, c.phone as customer_phone,
              u.name as verified_by_name
       FROM payments p
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON p.verified_by = u.id
       ${where}
       ORDER BY p.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      payments: result.rows,
    });
  } catch (error) {
    console.error('getPayments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createPayment = async (req, res) => {
  try {
    const { order_id, method, amount, reference } = req.body;
    if (!order_id || !method || !amount) {
      return res.status(400).json({ success: false, message: 'order_id, method and amount are required' });
    }

    // Check order exists
    const order = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (order.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const result = await pool.query(
      `INSERT INTO payments (order_id, method, amount, reference)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [order_id, method, amount, reference]
    );

    res.status(201).json({ success: true, message: 'Payment recorded', payment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reference } = req.body;

    await client.query('BEGIN');

    // Verify the payment
    const payment = await client.query(
      `UPDATE payments SET
        status = 'verified',
        reference = COALESCE($1, reference),
        verified_by = $2,
        verified_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [reference, req.user.id, id]
    );

    if (payment.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Payment not found or already verified' });
    }

    // Update order payment status
    await client.query(
      `UPDATE orders SET payment_status = 'paid', updated_at = NOW()
       WHERE id = $1`,
      [payment.rows[0].order_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: payment.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const failPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE payments SET status = 'failed', updated_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found or already processed' });
    }
    res.json({ success: true, message: 'Payment marked as failed', payment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT
        method,
        status,
        COUNT(*) as count,
        SUM(amount) as total
       FROM payments
       WHERE DATE(created_at) = $1
       GROUP BY method, status
       ORDER BY method, status`,
      [targetDate]
    );

    const pending = await pool.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM payments WHERE status = 'pending'`
    );

    res.json({
      success: true,
      date: targetDate,
      summary: result.rows,
      pending_verification: pending.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getPayments, createPayment, verifyPayment, failPayment, getPaymentSummary };
