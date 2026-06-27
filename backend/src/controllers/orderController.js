const { body } = require('express-validator');
const pool = require('../config/db');
const { queueMessage } = require('./whatsappController');
const { calculateSurcharge } = require('./surchargeRuleController');
const { calculateAutoDiscount } = require('./discountRuleController');

/* ─── Order number generator ──────────────────────────────────── */
const generateOrderNumber = async (client) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // e.g. 20260621

  /* Atomic sequence increment — INSERT ... ON CONFLICT DO UPDATE is
     guaranteed atomic at the row level in Postgres, so two concurrent
     transactions calling this at the same instant will serialize on
     this row automatically. This replaces the old COUNT(*) approach,
     which had a real race condition: two orders created within
     milliseconds of each other could both read the same count before
     either committed, producing duplicate order numbers. */
  const result = await client.query(
    `INSERT INTO order_sequences (date_key, last_seq)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (date_key) DO UPDATE SET last_seq = order_sequences.last_seq + 1
     RETURNING last_seq`
  );

  const seq = result.rows[0].last_seq;
  return `SW-ORD-${today}-${String(seq).padStart(3, '0')}`;
};

const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('payment_method').isIn(['cash', 'momo', 'cod']).withMessage('Payment method must be cash, momo, or cod'),
  body('delivery_address').notEmpty().withMessage('Delivery address is required'),
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending','confirmed','packing','assigned','processing','out_for_delivery','delivered','failed','returned'])
    .withMessage('Invalid order status'),
];

const getOrders = async (req, res) => {
  try {
    const { status, payment_method, search, date, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status)         { conditions.push(`o.status = $${i++}`);          values.push(status); }
    if (payment_method) { conditions.push(`o.payment_method = $${i++}`);  values.push(payment_method); }
    if (date)           { conditions.push(`DATE(o.created_at) = $${i++}`); values.push(date); }
    if (start_date)     { conditions.push(`DATE(o.created_at) >= $${i++}`); values.push(start_date); }
    if (end_date)       { conditions.push(`DATE(o.created_at) <= $${i++}`); values.push(end_date); }
    if (search) {
      conditions.push(`(c.name ILIKE $${i} OR c.phone ILIKE $${i} OR o.order_number ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN LATERAL (SELECT * FROM deliveries WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) d ON true
       LEFT JOIN riders r ON d.rider_id = r.id
       ${where}`,
      values
    );

    const result = await pool.query(
      `SELECT o.id, o.order_number, o.customer_id, o.status, o.payment_method, o.payment_status,
              o.total_amount, o.delivery_address, o.notes, o.created_at, o.updated_at,
              c.name as customer_name, c.phone as customer_phone,
              r.name as rider_name, r.phone as rider_phone,
              d.id as delivery_id, d.status as delivery_status
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN LATERAL (SELECT * FROM deliveries WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) d ON true
       LEFT JOIN riders r ON d.rider_id = r.id
       ${where} ORDER BY o.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count:  result.rows.length,
      total:  parseInt(countResult.rows[0].count),
      page:   parseInt(page),
      pages:  Math.ceil(parseInt(countResult.rows[0].count) / limit),
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
      `SELECT o.id, o.order_number, o.customer_id, o.status, o.payment_method, o.payment_status,
              o.total_amount, o.delivery_address, o.notes, o.created_at, o.updated_at,
              c.name as customer_name, c.phone as customer_phone,
              r.name as rider_name, r.phone as rider_phone,
              d.id as delivery_id, d.status as delivery_status,
              p.reference as payment_reference, p.status as payment_status_detail,
              p.verified_at as payment_verified_at
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN LATERAL (SELECT * FROM deliveries WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) d ON true
       LEFT JOIN riders r ON d.rider_id = r.id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1`,
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      customer_id, items, payment_method, delivery_address, notes, momo_reference,
      delivery_zone_id, manual_discount, discount_reason,
    } = req.body;

    // Validate stock
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

    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    /* ── Delivery zone + fee calculation ──────────────────────────
       Recalculated entirely server-side. Never trust a fee/discount
       sent from the client — always recompute from the zone + rules
       in the database. */
    let deliveryFee = 0;
    let surchargeApplied = 0;
    let zone = null;

    if (delivery_zone_id) {
      const zoneResult = await client.query(
        'SELECT * FROM delivery_zones WHERE id = $1 AND is_active = true',
        [delivery_zone_id]
      );
      if (zoneResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Selected delivery zone is not valid or no longer active' });
      }
      zone = zoneResult.rows[0];

      if (zone.min_order_amount && subtotal < parseFloat(zone.min_order_amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `${zone.name} requires a minimum order of GH₵${zone.min_order_amount}. Current subtotal: GH₵${subtotal.toFixed(2)}`,
        });
      }

      const pricingSettings = await client.query('SELECT * FROM pricing_settings WHERE id = 1');
      const threshold = pricingSettings.rows[0]?.free_delivery_threshold;
      const qualifiesForFreeDelivery = threshold != null && subtotal >= parseFloat(threshold);

      if (qualifiesForFreeDelivery) {
        deliveryFee = 0;
      } else {
        const baseFee = parseFloat(zone.fee);
        surchargeApplied = await calculateSurcharge(baseFee, new Date());
        deliveryFee = baseFee + surchargeApplied;
      }
    }

    /* ── Discount calculation ──────────────────────────────────────
       Manual discount OVERRIDES automatic rules entirely when present. */
    let discount = 0;
    let appliedDiscountReason = null;

    if (manual_discount && parseFloat(manual_discount) > 0) {
      const pricingSettings = await client.query('SELECT * FROM pricing_settings WHERE id = 1');
      const cap     = parseFloat(pricingSettings.rows[0]?.max_manual_discount || 0);
      const capType = pricingSettings.rows[0]?.max_manual_discount_type || 'fixed';
      const requested = parseFloat(manual_discount);

      const capAmount = capType === 'percent' ? subtotal * (cap / 100) : cap;

      if (requested > capAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Manual discount of GH₵${requested.toFixed(2)} exceeds the maximum allowed (GH₵${capAmount.toFixed(2)}). Ask a super admin to apply a larger discount.`,
        });
      }

      discount = requested;
      appliedDiscountReason = discount_reason || 'Manual discount';
    } else {
      const auto = await calculateAutoDiscount(subtotal);
      if (auto.rule) {
        discount = auto.amount;
        appliedDiscountReason = `Auto-applied: ${auto.rule.label}`;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee - discount);

    const orderNumber = await generateOrderNumber(client);

    const order = await client.query(
      `INSERT INTO orders (
         order_number, customer_id, payment_method, total_amount,
         delivery_address, notes, delivery_zone_id, delivery_fee,
         surcharge_applied, discount, discount_reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [orderNumber, customer_id, payment_method, total, delivery_address, notes,
       delivery_zone_id || null, deliveryFee, surchargeApplied, discount, appliedDiscountReason]
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

    // Auto-create payment record — store MoMo reference if provided
    await client.query(
      `INSERT INTO payments (order_id, method, amount, reference)
       VALUES ($1, $2, $3, $4)`,
      [orderId, payment_method, total, momo_reference || null]
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
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Release rider when order reaches a final state
    if (['delivered', 'failed', 'returned'].includes(status)) {
      const delivery = await client.query(
        'SELECT rider_id FROM deliveries WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
      if (delivery.rows.length > 0 && delivery.rows[0].rider_id) {
        await client.query(
          'UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1',
          [delivery.rows[0].rider_id]
        );
      }
      await client.query(
        'UPDATE deliveries SET status = $1, updated_at = NOW() WHERE order_id = $2',
        [status, id]
      );
    }

    await client.query('COMMIT');

    /* Queue WhatsApp message for customer */
    const triggerStatuses = ['confirmed', 'packing', 'out_for_delivery', 'delivered', 'failed'];
    if (triggerStatuses.includes(status)) {
      try {
        const orderRes = await pool.query(
          `SELECT o.*, c.name as customer_name, c.phone as customer_phone
           FROM orders o
           LEFT JOIN customers c ON o.customer_id = c.id
           WHERE o.id = $1`,
          [id]
        );
        if (orderRes.rows.length > 0) {
          await queueMessage(orderRes.rows[0], status);
        }
      } catch (qErr) {
        console.error('queueMessage error (non-critical):', qErr.message);
      }
    }

    res.json({ success: true, message: 'Order status updated', order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const deleteOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const check = await client.query('SELECT id, order_number FROM orders WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    await client.query('DELETE FROM payments WHERE order_id = $1', [id]);
    await client.query('DELETE FROM deliveries WHERE order_id = $1', [id]);
    await client.query('DELETE FROM cash_logs WHERE order_id = $1', [id]);
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

module.exports = {
  getOrders, getOrder, createOrder, updateOrderStatus,
  deleteOrder, createOrderValidation, updateStatusValidation,
};
