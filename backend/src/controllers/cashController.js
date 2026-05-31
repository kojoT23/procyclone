const pool = require('../config/db');

const getCashLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cl.*, r.name as rider_name, o.order_number
       FROM cash_logs cl
       LEFT JOIN riders r ON cl.rider_id = r.id
       LEFT JOIN orders o ON cl.order_id = o.id
       ORDER BY cl.created_at DESC`
    );
    res.json({ success: true, count: result.rows.length, cash_logs: result.rows });
  } catch (error) {
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
    await pool.query(
      'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2',
      ['paid', order_id]
    );
    res.status(201).json({ success: true, message: 'Cash log created', cash_log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyCashLog = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE cash_logs SET status = 'verified', verified_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cash log not found' });
    }
    res.json({ success: true, message: 'Cash verified', cash_log: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getDailyReport = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const orders = await pool.query(
      `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue,
       COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
       COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_orders,
       COUNT(CASE WHEN payment_method = 'momo' THEN 1 END) as momo_orders
       FROM orders WHERE DATE(created_at) = $1`,
      [today]
    );
    const cash = await pool.query(
      `SELECT SUM(amount) as total_cash_collected,
       COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_count
       FROM cash_logs WHERE DATE(created_at) = $1`,
      [today]
    );
    res.json({
      success: true,
      date: today,
      orders: orders.rows[0],
      cash: cash.rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getCashLogs, createCashLog, verifyCashLog, getDailyReport };