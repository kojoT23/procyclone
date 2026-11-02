/* ═══════════════════════════════════════════════════════════════
   Promo code rules, in ONE place so the "check my code" preview and
   the real order creation can never disagree about what a code is
   worth. The server always decides the final discount — a price or
   discount sent by the browser is never trusted.
═══════════════════════════════════════════════════════════════ */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const normalizeCode = (c) => String(c || '').trim().toUpperCase();

// `db` is either the pool or a transaction client — both have .query().
// lock:true adds FOR UPDATE, used inside order creation so two orders
// can't both claim the last use of a limited code.
const findPromo = async (db, code, { lock = false } = {}) => {
  const result = await db.query(
    `SELECT * FROM promo_codes WHERE UPPER(code) = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [normalizeCode(code)]
  );
  return result.rows[0] || null;
};

// Pure check: is this promo row usable on this subtotal, and for how much?
// Discounts apply to the items subtotal only, never to delivery.
const evaluatePromo = (promo, subtotal, now = new Date()) => {
  if (!promo || !promo.is_active) return { ok: false, message: "That promo code isn't valid" };
  if (promo.starts_at && new Date(promo.starts_at) > now) return { ok: false, message: "That promo code isn't active yet" };
  if (promo.expires_at && new Date(promo.expires_at) < now) return { ok: false, message: 'That promo code has expired' };
  if (promo.max_uses != null && promo.times_used >= promo.max_uses) return { ok: false, message: 'That promo code has been fully redeemed' };

  const min = parseFloat(promo.min_order_amount) || 0;
  if (subtotal < min) return { ok: false, message: `This code needs a minimum order of GH₵${min.toFixed(2)}` };

  const value = parseFloat(promo.discount_value);
  let discount = promo.discount_type === 'percent' ? subtotal * (value / 100) : value;
  if (promo.discount_type === 'percent' && promo.max_discount_amount != null) {
    discount = Math.min(discount, parseFloat(promo.max_discount_amount));
  }
  discount = round2(Math.min(discount, subtotal)); // never more than the items cost
  if (discount <= 0) return { ok: false, message: "That promo code isn't valid" };

  return { ok: true, discount };
};

module.exports = { normalizeCode, findPromo, evaluatePromo, round2 };
