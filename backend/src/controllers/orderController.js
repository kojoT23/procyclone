const { body } = require('express-validator');
const pool = require('../config/db');

const generateOrderNumber = () => 'ORD-' + Date.now();

const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('payment_method').isIn(['cash', 'momo']).withMessage('Payment method must be cash or momo'),
  body('delivery_address').notEmpty().withMessage('Delivery address is required'),
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending','confirmed','packing','assigned','out_for_delivery','delivered','failed','returned'])
    .withMessage('Invalid order status'),
];

const getOrders = async (req, res) => {
  try {
    const { status, payment_method, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`o.status = $${i++}`); values.push(status); }
    if (payment_method) { conditions.push(`o.payment_method = $${i++}`); values.push(payment_method); }
    if (search) {
      conditions.push(`(c.name ILIKE $${i} OR c.phone ILIKE $${i} OR o.order_number ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ${where}`,
      values
    );

    const result = await pool.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
       ${where} ORDER BY o.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      orders: result.rows,
    });
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await pool.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`, [id]
    );
    if (order.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const items = await pool.query(
      `SELECT oi.*, p.name as product_name FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`, [id]
    );
    res.json({ success: true, order: { ...order.rows[0], items: items.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, items, payment_method, delivery_address, notes } = req.body;

    for (const item of items) {
      const product = await client.query(
        'SELECT id, name, stock_quantity FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      if (product.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Product ID ${item.product_id} not found` });
      }
      if (product.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.rows[0].name}. Available: ${product.rows[0].stock_quantity}`,
        });
      }
    }

    const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    const order = await client.query(
      `INSERT INTO orders (order_number, customer_id, payment_method, total_amount, delivery_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [generateOrderNumber(), customer_id, payment_method, total, delivery_address, notes]
    );

    const orderId = order.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
// Auto-create payment record
   await client.query(
     `INSERT INTO payments (order_id, method, amount)
      VALUES ($1, $2, $3)`,
    [orderId, payment_method, total]
);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Order created', order: order.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
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
const deleteOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Check order exists
    const check = await client.query('SELECT id, order_number FROM orders WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Delete related records first
    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    await client.query('DELETE FROM payments WHERE order_id = $1', [id]);
    await client.query('DELETE FROM deliveries WHERE order_id = $1', [id]);
    await client.query('DELETE FROM cash_logs WHERE order_id = $1', [id]);

    // Now delete the order
    await client.query('DELETE FROM orders WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ success: true, message: `Order ${check.rows[0].order_number} deleted` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};




module.exports = { getOrders, getOrder, createOrder, updateOrderStatus, deleteOrder, createOrderValidation, updateStatusValidation };