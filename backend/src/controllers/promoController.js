const pool = require('../config/db');
const { findPromo, evaluatePromo } = require('../utils/promoService');

/* ═══════════════════════════════════════════════════════════════
   POST /api/promo/validate — PUBLIC. Lets the checkout preview what
   a code is worth before the customer places the order. Read-only:
   it never uses up the code. The real discount is re-checked (and the
   code actually consumed) when the order is created.
═══════════════════════════════════════════════════════════════ */
const validatePromo = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Enter a promo code' });
    }
    const sub = parseFloat(subtotal);
    if (!Number.isFinite(sub) || sub <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total' });
    }

    const promo = await findPromo(pool, code);
    const result = evaluatePromo(promo, sub);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.json({ success: true, code: promo.code, discount: result.discount, description: promo.description || null });
  } catch (error) {
    console.error('validatePromo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { validatePromo };
