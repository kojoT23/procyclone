
const pool = require('../config/db');

const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM customers ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      customers: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
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
      'INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, email, address]
    );
    res.status(201).json({ success: true, message: 'Customer created', customer: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Phone number already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      'UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, phone, email, address, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, message: 'Customer updated', customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteCustomer = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const check = await client.query('SELECT id, name FROM customers WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Delete related records first
    const orders = await client.query('SELECT id FROM orders WHERE customer_id = $1', [id]);
    for (const order of orders.rows) {
      await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);
      await client.query('DELETE FROM payments WHERE order_id = $1', [order.id]);
      await client.query('DELETE FROM deliveries WHERE order_id = $1', [order.id]);
      await client.query('DELETE FROM cash_logs WHERE order_id = $1', [order.id]);
    }
    await client.query('DELETE FROM orders WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM customers WHERE id = $1', [id]);

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

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
