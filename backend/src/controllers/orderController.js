const pool = require('../config/db');

const generateOrderNumber = () => {
  return 'ORD' + Date.now();
};

const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, count: result.rows.length, orders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await pool.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
      [id]
    );
    if (order.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const items = await pool.query(
      `SELECT oi.*, p.name as product_name FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`,
      [id]
    );
    res.json({ success: true, order: { ...order.rows[0], items: items.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createOrder = async (req, res) => {
  try {
    const { customer_id, items, payment_method, delivery_address, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have items' });
    }
    let total = 0;
    for (const item of items) {
      total += item.unit_price * item.quantity;
    }
    const order = await pool.query(
      `INSERT INTO orders (order_number, customer_id, payment_method, total_amount, delivery_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [generateOrderNumber(), customer_id, payment_method, total, delivery_address, notes]
    );
    const orderId = order.rows[0].id;
    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
      await pool.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    res.status(201).json({ success: true, message: 'Order created', order: order.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order status updated', order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getOrders, getOrder, createOrder, updateOrderStatus };