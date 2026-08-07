const crypto = require('crypto');
const pool = require('../config/db');
const { calculateSurcharge } = require('./surchargeRuleController');

/* ═══════════════════════════════════════════════════════════════════
   FLEEPYSTORE → SHOREWINDS ORDER WEBHOOK
   ═══════════════════════════════════════════════════════════════════

   Endpoint: POST /api/webhooks/fleepystore

   This is a SERVER-TO-SERVER endpoint — Fleepystore calls it directly,
   there is no logged-in user, so it is NOT protected by the normal
   `protect`/`authorize` JWT middleware. Instead it's protected by an
   HMAC signature check (verifySignature below), using a shared secret
   both sides know (FLEEPYSTORE_WEBHOOK_SECRET in .env).

   ── Expected payload shape ──────────────────────────────────────────
   {
     "external_order_id": "FLPY-2026-000123",   // Fleepystore's own order ID — REQUIRED, used for idempotency
     "customer": {
       "name": "Ama Owusu",
       "phone": "0244123456",                    // REQUIRED — used to find-or-create the customer
       "email": "ama@example.com",                // optional
       "address": "House 12, East Legon"           // optional, falls back to delivery_address if omitted
     },
     "items": [
       { "sku": "SW-1001", "quantity": 2, "unit_price": 45.00 }
       // matched by SKU, not product_id — Fleepystore never needs to
       // know Shorewinds' internal product IDs
     ],
     "delivery_zone_name": "East Legon",          // REQUIRED — matched by name against delivery_zones
     "delivery_address": "House 12, East Legon",   // REQUIRED
     "payment_method": "momo",                     // REQUIRED — "momo" or "cod" (cash not expected from a storefront)
     "momo_reference": "MP240811.1234.A56789",     // REQUIRED if payment_method is "momo", ignored otherwise
     "notes": "Leave at gate if no answer"          // optional
   }

   ── What this endpoint does NOT do ──────────────────────────────────
   - It does NOT confirm MoMo payment. That stays entirely manual —
     staff verify momo_reference against the real MoMo account and flip
     payment_status themselves via the existing order-management UI.
   - It does NOT touch cash_logs. COD cash collection is logged later,
     when a rider actually collects it — same as manual COD orders today.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Signature verification ──────────────────────────────────────────
   Fleepystore signs the raw JSON body with HMAC-SHA256 using the shared
   secret, sent as header `x-fleepystore-signature`. We recompute it
   over the exact raw bytes we received and compare with a constant-time
   check (timingSafeEqual) — a plain === comparison would leak timing
   information about how many leading bytes matched, letting an attacker
   guess the correct signature byte-by-byte over many requests. */
const verifySignature = (req) => {
  const signature = req.headers['x-fleepystore-signature'];
  const secret = process.env.FLEEPYSTORE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('FLEEPYSTORE_WEBHOOK_SECRET is not set in .env — refusing all webhook requests until configured.');
    return false;
  }
  if (!signature || !req.rawBody) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expected, 'utf8');

  if (sigBuffer.length !== expBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expBuffer);
};

const receiveFleepystoreOrder = async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ success: false, message: 'Invalid or missing signature' });
  }

  const {
    external_order_id, customer, items, delivery_zone_name,
    delivery_address, payment_method, momo_reference, notes,
  } = req.body;

  // ── Basic payload validation ──────────────────────────────────────
  if (!external_order_id) {
    return res.status(400).json({ success: false, message: 'external_order_id is required' });
  }
  if (!customer?.phone) {
    return res.status(400).json({ success: false, message: 'customer.phone is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
  }
  if (!delivery_zone_name) {
    return res.status(400).json({ success: false, message: 'delivery_zone_name is required' });
  }
  if (!['momo', 'cod'].includes(payment_method)) {
    return res.status(400).json({ success: false, message: 'payment_method must be "momo" or "cod"' });
  }
  if (payment_method === 'momo' && !momo_reference) {
    return res.status(400).json({ success: false, message: 'momo_reference is required when payment_method is "momo"' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Idempotency check ─────────────────────────────────────────
    // If Fleepystore retries this exact order (timeout, network blip),
    // return the already-created order as a SUCCESS (200), not an
    // error — that's what stops a well-behaved webhook sender from
    // retrying forever, and guarantees we never double-create.
    const existing = await client.query(
      'SELECT * FROM orders WHERE external_order_id = $1',
      [external_order_id]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({
        success: true,
        message: 'Order already received (idempotent replay)',
        order: existing.rows[0],
      });
    }

    // ── Find or create customer by phone ──────────────────────────
    let customerId;
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE phone = $1',
      [customer.phone]
    );
    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id;
    } else {
      const newCustomer = await client.query(
        `INSERT INTO customers (name, phone, email, address)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [customer.name || 'Fleepystore Customer', customer.phone, customer.email || null, customer.address || delivery_address || null]
      );
      customerId = newCustomer.rows[0].id;
    }

    // ── Resolve delivery zone by name (not ID — Fleepystore and
    //    Shorewinds don't share a database, so IDs can't be trusted
    //    to line up) ──────────────────────────────────────────────
    const zoneResult = await client.query(
      'SELECT * FROM delivery_zones WHERE name = $1 AND is_active = true',
      [delivery_zone_name]
    );
    if (zoneResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Delivery zone "${delivery_zone_name}" not found or not active in Shorewinds`,
      });
    }
    const zone = zoneResult.rows[0];

    // ── Resolve items by SKU + validate stock ─────────────────────
    const resolvedItems = [];
    for (const item of items) {
      if (!item.sku || !item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Each item needs sku and quantity' });
      }
      const product = await client.query(
        'SELECT id, name, sku, stock_quantity, cost_price FROM products WHERE sku = $1 AND is_active = true',
        [item.sku]
      );
      if (product.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Product with SKU "${item.sku}" not found` });
      }
      if (product.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.rows[0].name} (SKU ${item.sku}). Available: ${product.rows[0].stock_quantity}`,
        });
      }
      // unit_price: trust Fleepystore's displayed price (what the
      // customer actually agreed to pay), not Shorewinds' current
      // price — those can legitimately differ briefly if a price
      // changed between page load and checkout.
      resolvedItems.push({
        product_id: product.rows[0].id,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
      });
    }

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    // ── Delivery fee — same zone+surcharge logic as manual orders ──
    if (zone.min_order_amount && subtotal < parseFloat(zone.min_order_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `${zone.name} requires a minimum order of GH₵${zone.min_order_amount}. Subtotal: GH₵${subtotal.toFixed(2)}`,
      });
    }
    const baseFee = parseFloat(zone.fee);
    const surchargeApplied = await calculateSurcharge(baseFee, new Date());
    const deliveryFee = baseFee + surchargeApplied;

    const total = subtotal + deliveryFee;

    // ── payment_status: reflects that NOTHING is verified yet.
    //    A human confirms MoMo against the real account, or a rider
    //    collects COD cash — this endpoint never marks anything paid. */
    const paymentStatus = payment_method === 'momo' ? 'pending_verification' : 'pending_collection';

    const orderNumberResult = await client.query(
      `INSERT INTO order_sequences (date_key, last_seq)
       VALUES (CURRENT_DATE, 1)
       ON CONFLICT (date_key) DO UPDATE SET last_seq = order_sequences.last_seq + 1
       RETURNING last_seq`
    );
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `SW-ORD-${today}-${String(orderNumberResult.rows[0].last_seq).padStart(3, '0')}`;

    const order = await client.query(
      `INSERT INTO orders (
         order_number, customer_id, payment_method, payment_status, total_amount,
         delivery_address, notes, delivery_zone_id, delivery_fee, surcharge_applied,
         source, external_order_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'fleepystore', $11)
       RETURNING *`,
      [orderNumber, customerId, payment_method, paymentStatus, total,
       delivery_address, notes || null, zone.id, deliveryFee, surchargeApplied,
       external_order_id]
    );
    const orderId = order.rows[0].id;

    // ── Stock decrement — same atomic, race-safe pattern as manual
    //    order creation: only succeeds if stock is still sufficient
    //    at the exact moment it runs. ──────────────────────────────
    for (const item of resolvedItems) {
      const decrement = await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW()
         WHERE id = $2 AND stock_quantity >= $1
         RETURNING stock_quantity`,
        [item.quantity, item.product_id]
      );
      if (decrement.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Stock changed for product ID ${item.product_id} — insufficient stock now. Order not created.`,
        });
      }
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
    }

    // ── Payment record ─────────────────────────────────────────────
    await client.query(
      `INSERT INTO payments (order_id, method, amount, reference, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [orderId, payment_method, total, payment_method === 'momo' ? momo_reference : null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order received',
      order: order.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    // A duplicate momo_reference will surface here as a unique-constraint
    // violation (Postgres error code 23505) on payments.reference —
    // give Fleepystore a clear, specific reason rather than a generic 500.
    if (error.code === '23505' && error.constraint === 'payments_reference_unique') {
      return res.status(409).json({
        success: false,
        message: 'This MoMo reference has already been used on another order',
      });
    }
    console.error('receiveFleepystoreOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { receiveFleepystoreOrder };
