const pool = require('../config/db');

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

    await client.query('BEGIN');

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
    const totalAmount = Math.max(subtotal - discountAmount, 0);
    const saleNumber = await generateSaleNumber(client);

    const result = await client.query(
      `INSERT INTO pos_sales
        (sale_number, cashier_id, items, subtotal, discount, total_amount,
         payment_method, payment_reference, customer_name, customer_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [saleNumber, req.user.id, JSON.stringify(saleItems), subtotal, discountAmount, totalAmount,
       payment_method, payment_reference || null, customer_name || null, customer_phone || null, notes || null]
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
    const { items } = req.body;
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
    try {
      await client.query('BEGIN');
      saleNumber = await generateSaleNumber(client);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const result = await pool.query(
      `INSERT INTO pos_sales (sale_number, items, subtotal, discount, total_amount, status)
       VALUES ($1, $2, $3, 0, $3, 'pending_payment') RETURNING *`,
      [saleNumber, JSON.stringify(saleItems), subtotal]
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

module.exports = { createSale, getSales, getSummary, selfCheckout, confirmSale };
