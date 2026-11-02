const crypto = require('crypto');
const { createOrder, OrderError } = require('../utils/orderCreation');
const { isValidGhanaPhone } = require('../utils/phoneValidation');

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

  if (!customer?.phone) {
    return res.status(400).json({ success: false, message: 'customer.phone is required' });
  }
  if (!isValidGhanaPhone(customer.phone)) {
    return res.status(400).json({ success: false, message: 'customer.phone must be a valid Ghana phone number' });
  }

  try {
    const { order, replay } = await createOrder({
      external_order_id, customer, items, delivery_zone_name, delivery_address,
      payment_method, momo_reference, notes,
      source: 'fleepystore',
      // Trust Fleepystore's displayed price — what the customer actually
      // agreed to pay on THEIR page, which can legitimately differ
      // briefly from Shorewinds' current price.
      trustClientPrice: true,
    });
    res.status(replay ? 200 : 201).json({
      success: true,
      message: replay ? 'Order already received (idempotent replay)' : 'Order received',
      order,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('receiveFleepystoreOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { receiveFleepystoreOrder };
