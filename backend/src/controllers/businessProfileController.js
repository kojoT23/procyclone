const { body } = require('express-validator');
const pool = require('../config/db');

/* ─── Validation ───────────────────────────────────────────────────
   address/phone/momo_number are all optional individually (a shop might
   not have entered all three yet) but if provided, must be sane strings.
   business_name is required — receipts need *something* to print. */
const updateBusinessProfileValidation = [
  body('business_name')
    .notEmpty().withMessage('Business name is required')
    .isLength({ max: 150 }).withMessage('Business name is too long'),
  body('address')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Address is too long'),
  body('phone')
    .optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Phone number is too long'),
  body('momo_number')
    .optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('MoMo number is too long'),
];

/* ─── GET /api/business-profile ───────────────────────────────────
   Public to any authenticated user — receipts, the Settings page,
   and anywhere else in the app may need to read these details. */
const getBusinessProfile = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM business_profile WHERE id = 1');

    if (result.rows.length === 0) {
      // Should never happen if the migration ran, but don't crash receipts if it does
      return res.json({
        success: true,
        profile: { business_name: 'Shorewinds', address: null, phone: null, momo_number: null },
      });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('getBusinessProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── PUT /api/business-profile ───────────────────────────────────
   super_admin only (enforced in the route via authorize()).
   Always updates the single row (id = 1) — never inserts a new one. */
const updateBusinessProfile = async (req, res) => {
  try {
    const { business_name, address, phone, momo_number } = req.body;

    const result = await pool.query(
      `UPDATE business_profile
       SET business_name = $1,
           address        = $2,
           phone          = $3,
           momo_number    = $4,
           updated_by     = $5,
           updated_at     = NOW()
       WHERE id = 1
       RETURNING *`,
      [business_name, address || null, phone || null, momo_number || null, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      // Defensive — row should always exist after migration; create it if somehow missing
      const inserted = await pool.query(
        `INSERT INTO business_profile (id, business_name, address, phone, momo_number, updated_by)
         VALUES (1, $1, $2, $3, $4, $5)
         RETURNING *`,
        [business_name, address || null, phone || null, momo_number || null, req.user?.id || null]
      );
      return res.json({ success: true, message: 'Business profile saved', profile: inserted.rows[0] });
    }

    res.json({ success: true, message: 'Business profile updated', profile: result.rows[0] });
  } catch (error) {
    console.error('updateBusinessProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getBusinessProfile, updateBusinessProfile, updateBusinessProfileValidation };
