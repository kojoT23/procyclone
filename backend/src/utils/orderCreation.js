const pool = require('../config/db');
const { calculateSurcharge } = require('../controllers/surchargeRuleController');
const { findOrRestoreOrCreateCustomer } = require('./customerLookup');
const { sendOrderConfirmationEmail } = require('./emailService');
const { findPromo, evaluatePromo } = require('./promoService');

/* Thrown for anything the caller should turn into a 4xx with a specific
   message. Anything else that escapes is a genuine 500 — let it propagate
   and let the caller's catch-all log it. */
class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ═══════════════════════════════════════════════════════════════
   createOrder(payload)

   The core order-creation logic — customer lookup, zone resolution,
   item/stock resolution, delivery fee, order + order_items + payment
   rows, stock decrement — used by BOTH:
     - webhookController.js  (signed, server-to-server, Fleepystore)
     - storefrontController.js (public, first-party, the React app itself)
   living here ONCE so a fix to one path can't silently miss the other.

   payload:
     external_order_id — REQUIRED, for idempotency. The webhook gets
       this from Fleepystore; the storefront generates its own.
     customer: { name, phone, email, address }
     items: [{ product_id?, sku?, quantity, unit_price? }]
       — needs product_id OR sku per item.
     delivery_zone_name, delivery_address, payment_method ('momo'|'cod'),
     momo_reference, notes, source (free text, stored as-is)
     trustClientPrice: boolean — true ONLY for the signed webhook,
       where unit_price is what the customer already saw and agreed to
       on Fleepystore's own page. false for the storefront's own
       checkout, where price always comes fresh from `products` —
       trusting a client-supplied price on our OWN frontend would let
       anyone forge a cheap checkout by editing the request in devtools.

   Returns { order, replay }. Throws OrderError for 4xx cases, or lets
   a real error escape for the caller to log and turn into a 500.
═══════════════════════════════════════════════════════════════ */
const createOrder = async (payload) => {
  const {
    external_order_id, customer, items, delivery_zone_name,
    delivery_address, payment_method, momo_reference, notes,
    source, trustClientPrice = false,
    // true ONLY for the storefront's own checkout: zone may be skipped,
    // delivery fee is then 0 and confirmed with the customer afterwards.
    // The signed webhook still requires a zone.
    zoneOptional = false,
    // Optional promo code — passed by the storefront checkout only.
    promo_code,
  } = payload;

  if (!external_order_id) throw new OrderError(400, 'external_order_id is required');
  if (!customer?.phone) throw new OrderError(400, 'customer.phone is required');
  if (!Array.isArray(items) || items.length === 0) throw new OrderError(400, 'items must be a non-empty array');
  if (!delivery_zone_name && !zoneOptional) throw new OrderError(400, 'delivery_zone_name is required');
  if (!delivery_address) throw new OrderError(400, 'delivery_address is required');
  if (!['momo', 'cod'].includes(payment_method)) throw new OrderError(400, 'payment_method must be "momo" or "cod"');
  if (payment_method === 'momo' && !momo_reference) throw new OrderError(400, 'momo_reference is required when payment_method is "momo"');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Idempotency — a retried request returns the existing order as
    //    a success, never double-creates. ──────────────────────────
    const existing = await client.query('SELECT * FROM orders WHERE external_order_id = $1', [external_order_id]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return { order: existing.rows[0], replay: true };
    }

    // ── Find, restore, or create customer by phone ─────────────────
    const customerId = await findOrRestoreOrCreateCustomer(client, {
      name: customer.name || 'Customer',
      phone: customer.phone,
      email: customer.email,
      address: customer.address || delivery_address,
    });

    // ── Resolve delivery zone by name ───────────────────────────────
    let zone = null;
    if (delivery_zone_name) {
      const zoneResult = await client.query(
        'SELECT * FROM delivery_zones WHERE name = $1 AND is_active = true',
        [delivery_zone_name]
      );
      if (zoneResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new OrderError(400, `Delivery zone "${delivery_zone_name}" not found or not active`);
      }
      zone = zoneResult.rows[0];
    }

    // ── Resolve items (by product_id or sku) + validate stock ──────
    const resolvedItems = [];
    for (const item of items) {
      if ((!item.product_id && !item.sku) || !item.quantity) {
        await client.query('ROLLBACK');
        throw new OrderError(400, 'Each item needs product_id or sku, plus quantity');
      }
      const lookupCol = item.product_id ? 'id' : 'sku'; // internal-only, never user-controlled column name
      const lookupVal = item.product_id || item.sku;
      const product = await client.query(
        `SELECT id, name, sku, price, stock_quantity FROM products WHERE ${lookupCol} = $1 AND is_active = true`,
        [lookupVal]
      );
      if (product.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new OrderError(400, `Product ${lookupVal} not found`);
      }
      if (product.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        throw new OrderError(400, `Insufficient stock for ${product.rows[0].name}. Available: ${product.rows[0].stock_quantity}`);
      }
      const unitPrice = trustClientPrice && item.unit_price != null
        ? parseFloat(item.unit_price)
        : parseFloat(product.rows[0].price);
      resolvedItems.push({
        product_id: product.rows[0].id,
        product_name: product.rows[0].name,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    if (zone && zone.min_order_amount && subtotal < parseFloat(zone.min_order_amount)) {
      await client.query('ROLLBACK');
      throw new OrderError(400, `${zone.name} requires a minimum order of GH₵${zone.min_order_amount}. Subtotal: GH₵${subtotal.toFixed(2)}`);
    }
    // ── Promo code — re-validated HERE under a row lock, so the discount is
    //    always the server's own figure and a limited code can't be claimed
    //    twice at once. Any problem fails the order with a clear message
    //    rather than silently charging full price. ───────────────────────
    let discountAmount = 0;
    let appliedPromoCode = null;
    if (promo_code) {
      const promo = await findPromo(client, promo_code, { lock: true });
      const result = evaluatePromo(promo, subtotal);
      if (!result.ok) {
        await client.query('ROLLBACK');
        throw new OrderError(400, result.message);
      }
      discountAmount = result.discount;
      appliedPromoCode = promo.code;
      await client.query('UPDATE promo_codes SET times_used = times_used + 1 WHERE id = $1', [promo.id]);
    }

    const baseFee = zone ? parseFloat(zone.fee) : 0;
    const surchargeApplied = zone ? await calculateSurcharge(baseFee, new Date()) : 0;
    const deliveryFee = baseFee + surchargeApplied;
    const total = subtotal - discountAmount + deliveryFee;

    // payment_status reflects that NOTHING is verified yet — a human
    // confirms MoMo, or a rider collects COD cash, same as before.
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
         source, external_order_id, promo_code, discount_amount
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [orderNumber, customerId, payment_method, paymentStatus, total,
       delivery_address, notes || null, zone ? zone.id : null, deliveryFee, surchargeApplied,
       source || 'unknown', external_order_id, appliedPromoCode, discountAmount]
    );
    const orderId = order.rows[0].id;

    // ── Stock decrement — atomic, race-safe: only succeeds if stock is
    //    still sufficient at the exact moment it runs. ────────────────
    for (const item of resolvedItems) {
      const decrement = await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW()
         WHERE id = $2 AND stock_quantity >= $1
         RETURNING stock_quantity`,
        [item.quantity, item.product_id]
      );
      if (decrement.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new OrderError(409, `Stock changed for ${item.product_name} — insufficient stock now. Order not created.`);
      }
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
    }

    await client.query(
      `INSERT INTO payments (order_id, method, amount, reference, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [orderId, payment_method, total, payment_method === 'momo' ? momo_reference : null]
    );

    await client.query('COMMIT');

    // Best-effort order-confirmation email — fires after commit so it can
    // never affect whether the order itself succeeds. Does nothing if the
    // customer didn't give an email (always optional); errors are caught
    // and logged inside sendOrderConfirmationEmail itself.
    sendOrderConfirmationEmail({
      to: customer.email,
      customerName: customer.name,
      orderNumber: order.rows[0].order_number,
      items: resolvedItems,
      deliveryFee,
      discount: discountAmount,
      promoCode: appliedPromoCode,
      total,
      paymentMethod: payment_method,
    });

    return { order: order.rows[0], replay: false };
  } catch (error) {
    await client.query('ROLLBACK');
    // A duplicate momo_reference surfaces as a unique-constraint violation
    // on payments.reference — give a clear, specific reason.
    if (error.code === '23505' && error.constraint === 'payments_reference_unique') {
      throw new OrderError(409, 'This MoMo reference has already been used on another order');
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { createOrder, OrderError };
