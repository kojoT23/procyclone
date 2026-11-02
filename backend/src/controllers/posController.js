const pool = require('../config/db');
const { findOrRestoreOrCreateCustomer } = require('../utils/customerLookup');
const { isValidGhanaPhone, normalizeGhanaPhone } = require('../utils/phoneValidation');

/* ═══════════════════════════════════════════════════════════════
   Discount limits for staff-typed sales: the biggest discount each
   role may give on one sale, as a % of that sale's subtotal. Above it
   the sale is refused and has to be rung up by someone higher. Any
   role not listed here (including new ones) can give no discount.
   Change the numbers to suit the shop.
═══════════════════════════════════════════════════════════════ */
const MAX_DISCOUNT_PERCENT = {
  super_admin: 100,
  admin: 100,
  manager: 25,
  cashier: 10,
  sales: 10,
};

const maxDiscountFor = (role, subtotal) => {
  const pct = MAX_DISCOUNT_PERCENT[role] ?? 0;
  return Math.round(subtotal * pct) / 100; // pct% of subtotal, to the pesewa
};

const generateSaleNumber = async (client) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const result = await client.query(
    `INSERT INTO pos_sequences (date_key, last_seq)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (date_key) DO UPDATE SET last_seq = pos_sequences.last_seq + 1
     RETURNING last_seq`
  );
  const seq = result.rows[0].last_seq;
  return `SW-POS-${today}-${String(seq).padStart(3, '0')}`;
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/pos/sales
   Completes a walk-in sale: validates stock for every item, decrements
   it, and records the sale. All in one transaction — either the whole
   sale goes through or none of it does.
═══════════════════════════════════════════════════════════════ */
const createSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const { items, payment_method, payment_reference, discount, customer_name, customer_phone, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }
    if (!['cash', 'momo', 'card'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Payment method must be cash, momo, or card' });
    }

    if (customer_phone && !isValidGhanaPhone(customer_phone)) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ success: false, message: 'Please enter a valid Ghana phone number, e.g. 0244123456' });
    }

    await client.query('BEGIN');

    // Same find/restore/create pattern as selfCheckout and the storefront
    // webhook — a staff-typed sale with a customer name+phone now links to
    // a real customers row instead of just free-text fields.
    let customerId = null;
    if (customer_phone && customer_name) {
      customerId = await findOrRestoreOrCreateCustomer(client, {
        name: customer_name,
        phone: customer_phone,
      });
    }

    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, stock_quantity FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Product ID ${item.product_id} not found` });
      }
      const product = productResult.rows[0];
      const qty = parseInt(item.quantity);
      if (!qty || qty < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Invalid quantity for ${product.name}` });
      }
      if (product.stock_quantity < qty) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Not enough stock for ${product.name} — only ${product.stock_quantity} available`,
        });
      }

      const unitPrice = parseFloat(product.price);
      const lineSubtotal = unitPrice * qty;
      subtotal += lineSubtotal;
      saleItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: lineSubtotal,
      });

      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
        [qty, product.id]
      );
    }

    const discountAmount = parseFloat(discount) || 0;
    if (discountAmount < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Discount cannot be negative' });
    }
    const allowedDiscount = maxDiscountFor(req.user.role, subtotal);
    if (discountAmount > allowedDiscount) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: allowedDiscount > 0
          ? `Your limit on this sale is GH₵${allowedDiscount.toFixed(2)} off — a manager must approve a bigger discount.`
          : 'Your role cannot give discounts — ask a manager.',
      });
    }
    const totalAmount = Math.max(subtotal - discountAmount, 0);
    const saleNumber = await generateSaleNumber(client);

    const result = await client.query(
      `INSERT INTO pos_sales
        (sale_number, cashier_id, items, subtotal, discount, total_amount,
         payment_method, payment_reference, customer_name, customer_phone, customer_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [saleNumber, req.user.id, JSON.stringify(saleItems), subtotal, discountAmount, totalAmount,
       payment_method, payment_reference || null, customer_name || null, customer_phone || null, customerId, notes || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Sale completed', sale: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createSale error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/pos/sales
═══════════════════════════════════════════════════════════════ */
const getSales = async (req, res) => {
  try {
    const { date, start_date, end_date, cashier_id, status, page = 1, limit = 20 } = req.query;
    const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * lim;

    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`s.status = $${i++}`); values.push(status); }
    if (date) { conditions.push(`DATE(s.created_at) = $${i++}`); values.push(date); }
    if (start_date && end_date) {
      conditions.push(`DATE(s.created_at) >= $${i++} AND DATE(s.created_at) <= $${i++}`);
      values.push(start_date, end_date);
    }
    if (cashier_id) { conditions.push(`s.cashier_id = $${i++}`); values.push(cashier_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM pos_sales s ${where}`, values);
    const result = await pool.query(
      `SELECT s.*, u.name as cashier_name
       FROM pos_sales s LEFT JOIN users u ON s.cashier_id = u.id
       ${where} ORDER BY s.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, lim, offset]
    );

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / lim),
      sales: result.rows,
    });
  } catch (error) {
    console.error('getSales error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/pos/summary — today's totals, for a dashboard widget
═══════════════════════════════════════════════════════════════ */
const getSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) as sale_count,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'momo' THEN total_amount ELSE 0 END), 0) as momo_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_total
       FROM pos_sales WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'`
    );
    res.json({ success: true, summary: result.rows[0] });
  } catch (error) {
    console.error('getSummary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/pos/self-checkout — PUBLIC, no login required.
   A customer in the store builds their own cart and gets a ticket
   number to bring to a cashier. Stock is checked as a courtesy (so
   nobody gets a ticket for something already gone) but NOT reserved —
   an abandoned kiosk session shouldn't lock stock away from anyone
   else. Final stock check + decrement happens at confirmSale.
═══════════════════════════════════════════════════════════════ */
const selfCheckout = async (req, res) => {
  try {
    const { items, customer_name, customer_phone } = req.body;
    if (customer_phone && !isValidGhanaPhone(customer_phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Ghana phone number, e.g. 0244123456' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productResult = await pool.query(
        'SELECT id, name, price, stock_quantity FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      if (productResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: `A product in your cart is no longer available` });
      }
      const product = productResult.rows[0];
      const qty = parseInt(item.quantity);
      if (!qty || qty < 1) {
        return res.status(400).json({ success: false, message: `Invalid quantity for ${product.name}` });
      }
      if (product.stock_quantity < qty) {
        return res.status(409).json({ success: false, message: `Only ${product.stock_quantity} of ${product.name} left — please adjust your cart` });
      }
      const unitPrice = parseFloat(product.price);
      const lineSubtotal = unitPrice * qty;
      subtotal += lineSubtotal;
      saleItems.push({ product_id: product.id, product_name: product.name, quantity: qty, unit_price: unitPrice, subtotal: lineSubtotal });
    }

    const client = await pool.connect();
    let saleNumber;
    let customerId = null;
    try {
      await client.query('BEGIN');
      saleNumber = await generateSaleNumber(client);
      // A self-checkout customer only gives a phone, not a full
      // address — findOrRestoreOrCreateCustomer is fine with that,
      // it just won't overwrite an existing address with nothing.
      if (customer_phone && customer_name) {
        customerId = await findOrRestoreOrCreateCustomer(client, {
          name: customer_name,
          phone: customer_phone,
        });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const result = await pool.query(
      `INSERT INTO pos_sales (sale_number, items, subtotal, discount, total_amount, status, customer_name, customer_phone, customer_id)
       VALUES ($1, $2, $3, 0, $3, 'pending_payment', $4, $5, $6) RETURNING *`,
      [saleNumber, JSON.stringify(saleItems), subtotal, customer_name || null, customer_phone || null, customerId]
    );

    res.status(201).json({ success: true, sale: result.rows[0] });
  } catch (error) {
    console.error('selfCheckout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/pos/sales/:id/confirm — staff only. Re-validates stock
   (time has passed since the ticket was created, so it might have
   changed), decrements it, and completes the sale.
═══════════════════════════════════════════════════════════════ */
const confirmSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { payment_method, payment_reference } = req.body;

    if (!['cash', 'momo', 'card'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Payment method must be cash, momo, or card' });
    }

    await client.query('BEGIN');

    const sale = await client.query(
      `SELECT * FROM pos_sales WHERE id = $1 AND status = 'pending_payment'`,
      [id]
    );
    if (sale.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ticket not found or already confirmed' });
    }

    const items = sale.rows[0].items;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT name, stock_quantity FROM products WHERE id = $1', [item.product_id]
      );
      if (productResult.rows.length === 0 || productResult.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `${item.product_name} — only ${productResult.rows[0]?.stock_quantity ?? 0} left now, ticket had ${item.quantity}. Ask the customer to adjust.`,
        });
      }
    }
    for (const item of items) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    const updated = await client.query(
      `UPDATE pos_sales SET status = 'completed', cashier_id = $1, payment_method = $2, payment_reference = $3
       WHERE id = $4 RETURNING *`,
      [req.user.id, payment_method, payment_reference || null, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Payment confirmed', sale: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('confirmSale error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/pos/order-history?phone=0244123456 — PUBLIC, no login.
   A customer looks up their own self-checkout ticket history by
   phone. Matches on customer_id (post-linkage tickets) OR the raw
   customer_phone string (older tickets created before that linkage
   existed), so history doesn't silently drop pre-migration orders.
   Note: this only covers self-checkout/POS tickets, not online
   delivery orders placed via WhatsApp — those live in a separate
   `orders` flow this endpoint doesn't touch.
═══════════════════════════════════════════════════════════════ */
const getOrderHistoryByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || !isValidGhanaPhone(phone)) {
      return res.status(400).json({ success: false, message: 'A valid Ghana phone number is required' });
    }
    const normalizedPhone = normalizeGhanaPhone(phone);

    const customer = await pool.query(
      'SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL',
      [normalizedPhone]
    );
    const customerId = customer.rows[0]?.id || null;

    const sales = await pool.query(
      `SELECT sale_number, items, subtotal, discount, total_amount, status, created_at
       FROM pos_sales
       WHERE customer_id = $1 OR customer_phone = $2
       ORDER BY created_at DESC LIMIT 20`,
      [customerId, normalizedPhone]
    );

    res.json({ success: true, orders: sales.rows });
  } catch (error) {
    console.error('getOrderHistoryByPhone error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createSale, getSales, getSummary, selfCheckout, confirmSale, getOrderHistoryByPhone };
