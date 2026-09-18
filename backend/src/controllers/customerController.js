const pool = require('../config/db');

const CUSTOMER_COLUMNS = 'id, name, phone, email, address, notes, created_at, updated_at';

const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = ['deleted_at IS NULL'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM customers ${where}`, values);
    const result = await pool.query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page,
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      customers: result.rows,
    });
  } catch (error) {
    console.error('getCustomers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('getCustomer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    const result = await pool.query(
      `INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING ${CUSTOMER_COLUMNS}`,
      [name, phone, email || null, address || null]
    );
    res.status(201).json({ success: true, message: 'Customer created', customer: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Phone number already exists' });
    }
    console.error('createCustomer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    const result = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, updated_at=NOW()
       WHERE id=$5 AND deleted_at IS NULL RETURNING ${CUSTOMER_COLUMNS}`,
      [name, phone, email || null, address || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, message: 'Customer updated', customer: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Phone number already exists' });
    }
    console.error('updateCustomer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteCustomer = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const check = await client.query(
      'SELECT id, name FROM customers WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const openOrders = await client.query(
      `SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND status NOT IN ('delivered', 'cancelled', 'failed')`,
      [id]
    );
    if (parseInt(openOrders.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Customer has open orders — resolve or cancel them before deleting',
      });
    }

    await client.query('DELETE FROM customer_messages WHERE customer_id = $1', [id]);
    await client.query(
      `UPDATE customers SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: `Customer ${check.rows[0].name} deleted` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteCustomer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const getCustomerProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await pool.query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!customer.rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });

    const orders = await pool.query(
      `SELECT DISTINCT ON (o.id) o.*, r.name as rider_name
       FROM orders o
       LEFT JOIN deliveries d ON o.id = d.order_id
       LEFT JOIN riders r ON d.rider_id = r.id
       WHERE o.customer_id = $1
       ORDER BY o.id, d.created_at DESC NULLS LAST`,
      [id]
    );
    orders.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const stats = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) as total_spend,
        COALESCE(AVG(CASE WHEN status = 'delivered' THEN total_amount END), 0) as avg_order_value,
        MAX(created_at) as last_order_date
       FROM orders WHERE customer_id = $1`,
      [id]
    );

    res.json({
      success: true,
      customer: customer.rows[0],
      orders: orders.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error('getCustomerProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCustomerNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await pool.query(
      `UPDATE customers SET notes=$1, updated_at=NOW() WHERE id=$2 AND deleted_at IS NULL RETURNING ${CUSTOMER_COLUMNS}`,
      [notes, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('updateCustomerNotes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getCustomers, getCustomer, createCustomer, updateCustomer,
  deleteCustomer, getCustomerProfile, updateCustomerNotes,
};
