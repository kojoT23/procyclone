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

/* ── Mass Order — one entry per customer, each fully independent.
   No rider_id here on purpose: bulk-created orders stay unassigned
   and show up in Scheduler for a human to assign afterward, rather
   than forcing a single rider choice across an entire batch. */
const createBulkOrdersValidation = [
  body('orders').isArray({ min: 1 }).withMessage('Select at least one customer to place orders for'),
  body('orders.*.customer_id').isInt({ min: 1 }).withMessage('Each order needs a valid customer'),
  body('orders.*.items').isArray({ min: 1 }).withMessage('Each customer needs at least one item'),
  body('orders.*.items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
  body('orders.*.items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('orders.*.items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('orders.*.payment_method').isIn(['cash', 'momo', 'cod']).withMessage('Payment method must be cash, momo, or cod'),
  body('orders.*.delivery_address').notEmpty().withMessage('Delivery address is required'),
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending','confirmed','packing','assigned','processing','out_for_delivery','delivered','failed','returned','cancelled'])
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
              o.total_amount, o.delivery_address, o.notes, o.created_at, o.updated_at, o.created_by,
              c.name as customer_name, c.phone as customer_phone,
              r.name as rider_name, r.phone as rider_phone,
              d.id as delivery_id, d.status as delivery_status, d.rejection_reason
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
              o.total_amount, o.delivery_address, o.notes, o.created_at, o.updated_at, o.created_by,
              c.name as customer_name, c.phone as customer_phone,
              r.name as rider_name, r.phone as rider_phone,
              d.id as delivery_id, d.status as delivery_status,
              d.recipient_name, d.proof_note, d.delivery_notes,
              d.failure_reason, d.issue_type, d.picked_up_at, d.delivered_at,
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
         surcharge_applied, discount, discount_reason, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [orderNumber, customer_id, payment_method, total, delivery_address, notes,
       delivery_zone_id || null, deliveryFee, surchargeApplied, discount, appliedDiscountReason,
       req.user?.id || null]
    );

    const orderId = order.rows[0].id;

    for (const item of items) {
      // This UPDATE is the real stock guarantee, not the pre-check
      // above. The pre-check reads stock before this transaction has
      // written anything, so under concurrency two simultaneous orders
      // for the same last unit can both pass it (see the note above
      // createOrder). This conditional, atomic decrement is what
      // actually prevents that: it only succeeds if enough stock is
      // still there at the exact moment it runs, so a second order
      // racing for the same unit will fail here instead of going
      // through and driving stock negative.
      const decrement = await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW()
         WHERE id = $2 AND stock_quantity >= $1
         RETURNING stock_quantity, name`,
        [item.quantity, item.product_id]
      );
      if (decrement.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for product ID ${item.product_id} — someone else just bought it. Please refresh and try again.`,
        });
      }

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
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

/* ── Mass Order — create many independent orders in one call ────────
   Each entry in req.body.orders gets its OWN connection + transaction,
   run sequentially. That's deliberate: if customer #7 out of 20 has a
   stock problem, customers #1-6 (already committed) stay created, and
   #8-20 still get attempted — one bad row in a large batch shouldn't
   silently wipe out or block the rest. The response reports exactly
   which customers succeeded and which failed, and why, instead of an
   all-or-nothing result.

   The pricing/stock/discount logic below is intentionally a close
   mirror of createOrder above, not a shared call — see the comment
   at the top of this feature's rollout for why. If delivery fee,
   surcharge, or discount rules change, both places need updating. */
const createBulkOrders = async (req, res) => {
  const { orders } = req.body;
  const created = [];
  const failed = [];

  for (const orderData of orders) {
    const {
      customer_id, items, payment_method, delivery_address, notes, momo_reference,
      delivery_zone_id, manual_discount, discount_reason,
    } = orderData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Stock check
      let stockProblem = null;
      for (const item of items) {
        const product = await client.query(
          'SELECT id, name, stock_quantity FROM products WHERE id = $1 AND is_active = true',
          [item.product_id]
        );
        if (product.rows.length === 0) {
          stockProblem = `Product ID ${item.product_id} not found`;
          break;
        }
        if (product.rows[0].stock_quantity < item.quantity) {
          stockProblem = `Insufficient stock for ${product.rows[0].name}. Available: ${product.rows[0].stock_quantity}`;
          break;
        }
      }
      if (stockProblem) {
        await client.query('ROLLBACK');
        failed.push({ customer_id, message: stockProblem });
        continue;
      }

      const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

      // Delivery zone + fee
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
          failed.push({ customer_id, message: 'Selected delivery zone is not valid or no longer active' });
          continue;
        }
        zone = zoneResult.rows[0];

        if (zone.min_order_amount && subtotal < parseFloat(zone.min_order_amount)) {
          await client.query('ROLLBACK');
          failed.push({
            customer_id,
            message: `${zone.name} requires a minimum order of GH₵${zone.min_order_amount}. This customer's subtotal: GH₵${subtotal.toFixed(2)}`,
          });
          continue;
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

      // Discount
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
          failed.push({
            customer_id,
            message: `Manual discount of GH₵${requested.toFixed(2)} exceeds the maximum allowed (GH₵${capAmount.toFixed(2)})`,
          });
          continue;
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
           surcharge_applied, discount, discount_reason, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [orderNumber, customer_id, payment_method, total, delivery_address, notes || '',
         delivery_zone_id || null, deliveryFee, surchargeApplied, discount, appliedDiscountReason,
         req.user?.id || null]
      );
      const orderId = order.rows[0].id;

      let insufficientStockMsg = null;
      for (const item of items) {
        // Same reasoning as createOrder: the pre-check above can be
        // stale under concurrency, this atomic decrement is the real
        // guarantee against overselling.
        const decrement = await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW()
           WHERE id = $2 AND stock_quantity >= $1
           RETURNING stock_quantity, name`,
          [item.quantity, item.product_id]
        );
        if (decrement.rows.length === 0) {
          insufficientStockMsg = `Insufficient stock for product ID ${item.product_id} — stock changed since this batch started`;
          break;
        }
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
        );
      }
      if (insufficientStockMsg) {
        await client.query('ROLLBACK');
        failed.push({ customer_id, message: insufficientStockMsg });
        continue;
      }

      await client.query(
        `INSERT INTO payments (order_id, method, amount, reference)
         VALUES ($1, $2, $3, $4)`,
        [orderId, payment_method, total, momo_reference || null]
      );

      await client.query('COMMIT');
      created.push(order.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('createBulkOrders error for customer', customer_id, ':', error);
      failed.push({ customer_id, message: 'Server error creating this order' });
    } finally {
      client.release();
    }
  }

  // Always a 200-range status, even when every order in the batch fails —
  // the request itself was valid and fully processed; which individual
  // orders succeeded or failed is business-logic detail carried in the
  // JSON body (success/errors), not an HTTP error. Returning 400 here
  // made axios throw on a fully-failed batch, so MassOrder.js's normal
  // per-customer error banner never rendered — it hit the generic catch-
  // block alert instead, hiding the exact reason each customer failed.
  res.status(created.length > 0 ? 201 : 200).json({
    success: failed.length === 0,
    message: `${created.length} order${created.length !== 1 ? 's' : ''} created` +
      (failed.length > 0 ? `, ${failed.length} failed` : ''),
    created_count: created.length,
    failed_count: failed.length,
    orders: created,
    errors: failed,
  });
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

    // A 'returned' order means the delivery failed and the goods came back
    // to base. Money owed is flagged immediately (the customer's refund
    // doesn't wait on anything), but stock stays OUT of sellable inventory
    // until the person who handled the return completes an enquiry with
    // photo evidence — see returnController.js. This exists specifically
    // to prevent a return being silently written off as "damaged" with no
    // accountability trail.
    if (status === 'returned') {
      const items = await client.query(
        `SELECT oi.product_id, oi.quantity, p.name as product_name
         FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [id]
      );
      const itemSummary = items.rows
        .map(i => `${i.quantity}x ${i.product_name || 'Unknown product'}`)
        .join(', ');
      const itemsDetail = items.rows.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name || 'Unknown product',
        quantity_ordered: i.quantity,
        quantity_received: null,
      }));

      const paymentResult = await client.query(
        `UPDATE payments SET status = 'refund_pending', updated_at = NOW()
         WHERE order_id = $1 AND status = 'verified' RETURNING id`,
        [id]
      );
      const paymentId = paymentResult.rows[0]?.id || null;

      // Find the rider on this delivery, and — if they have a linked
      // login — assign the enquiry to them so it shows on their own
      // Rider Portal dashboard. Otherwise it falls to whoever just
      // marked the order returned.
      const deliveryRider = await client.query(
        `SELECT d.rider_id, r.user_id as rider_user_id
         FROM deliveries d LEFT JOIN riders r ON d.rider_id = r.id
         WHERE d.order_id = $1 ORDER BY d.created_at DESC LIMIT 1`,
        [id]
      );
      const riderId = deliveryRider.rows[0]?.rider_id || null;
      const assignedTo = deliveryRider.rows[0]?.rider_user_id || req.user.id;

      await client.query(
        `INSERT INTO order_returns
          (order_id, customer_id, item_summary, items_detail, restocked_by, payment_id,
           refund_status, rider_id, assigned_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_enquiry')`,
        [id, result.rows[0].customer_id, itemSummary, JSON.stringify(itemsDetail), req.user.id, paymentId,
         paymentId ? 'pending' : 'none', riderId, assignedTo]
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

    const check = await client.query('SELECT id, order_number, status FROM orders WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Restore stock before deleting — otherwise this inventory just
    // vanishes with no record of where it went. Skip this for orders
    // already 'cancelled': cancelOrder already restored their stock,
    // so doing it again here would double-credit it.
    if (check.rows[0].status !== 'cancelled') {
      const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [id]);
      for (const item of items.rows) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
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

/* ─── Delivery proof — split out from getOrder deliberately ─────
   proof_photo is a base64 image, potentially hundreds of KB. Every other
   getOrder call (printing a receipt, viewing item details, checking
   status) has no reason to pay that weight. This is the only place
   proof_photo is ever selected, so it's only fetched when someone
   actually taps "View Proof." ────────────────────────────────── */
const getDeliveryProof = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT proof_photo, recipient_name, delivery_notes, delivered_at
       FROM deliveries WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No delivery found for this order' });
    }
    res.json({ success: true, proof: result.rows[0] });
  } catch (error) {
    console.error('getDeliveryProof error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Cancel order — only before a rider is assigned ──────────── */
const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { reason } = req.body;

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = orderRes.rows[0];

    // Only 'pending' — the moment a rider is assigned, order.status moves
    // to 'confirmed' (see assignDelivery in riderController.js), and past
    // that point cancellation would also need to un-assign the rider and
    // free them back to available. Simplest, safest scope: before any of
    // that has happened at all.
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `This order can no longer be cancelled — it's already ${order.status.replace(/_/g, ' ')}. A rider may already be assigned.`,
      });
    }

    // Restore stock for every item — this sale never actually went
    // through, so the earlier decrement at createOrder needs reversing.
    const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [id]);
    for (const item of items.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Close out the pending payment record rather than leaving it dangling
    await client.query(
      `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE order_id = $1 AND status = 'pending'`,
      [id]
    );

    const result = await client.query(
      `UPDATE orders SET status = 'cancelled', cancellation_reason = $1, cancelled_by = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [reason || null, req.user?.id || null, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Order cancelled', order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('cancelOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getOrders, getOrder, createOrder, createBulkOrders, updateOrderStatus, cancelOrder, getDeliveryProof,
  deleteOrder, createOrderValidation, createBulkOrdersValidation, updateStatusValidation,
};
