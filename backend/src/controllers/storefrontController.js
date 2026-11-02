const crypto = require('crypto');
const pool = require('../config/db');
const { createOrder, OrderError } = require('../utils/orderCreation');
const { isValidGhanaPhone, normalizeGhanaPhone } = require('../utils/phoneValidation');

/* ═══════════════════════════════════════════════════════════════
   GET /api/storefront/delivery-zones — PUBLIC.
   Feeds the storefront's checkout form: names, fees, and minimum
   order amounts for every active zone, so the customer picks a real
   zone and sees the delivery fee before submitting.
═══════════════════════════════════════════════════════════════ */
const getDeliveryZones = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, fee, min_order_amount FROM delivery_zones WHERE is_active = true ORDER BY name'
    );
    res.json({ success: true, zones: result.rows });
  } catch (error) {
    console.error('getDeliveryZones error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/storefront/checkout — PUBLIC, no login. This IS the
   first party (our own React storefront), so — unlike the signed
   Fleepystore webhook — there's no HMAC signature here; the trust
   boundary is the same one self-checkout already uses. Generates
   its own external_order_id for the shared idempotency check, and
   always prices items fresh from the DB (never trusts a price the
   client sends — see orderCreation.js for why).
═══════════════════════════════════════════════════════════════ */
const checkout = async (req, res) => {
  const { customer, items, delivery_zone_name, delivery_address, payment_method, momo_reference, notes, promo_code } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ success: false, message: 'Customer name and phone are required' });
  }
  if (!isValidGhanaPhone(customer.phone)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid Ghana phone number' });
  }

  const externalOrderId = `WEB-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  try {
    const { order } = await createOrder({
      external_order_id: externalOrderId,
      customer: { ...customer, phone: normalizeGhanaPhone(customer.phone) },
      items, delivery_zone_name, delivery_address, payment_method, momo_reference, notes,
      source: 'storefront_web',
      trustClientPrice: false,
      zoneOptional: true,
      promo_code,
    });
    res.status(201).json({ success: true, order });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('storefront checkout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDeliveryZones, checkout };
