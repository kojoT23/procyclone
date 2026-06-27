const { body } = require('express-validator');
const pool = require('../config/db');

const pricingSettingsValidation = [
  body('free_delivery_threshold')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Free delivery threshold must be a positive number'),
  body('max_manual_discount')
    .isFloat({ min: 0 }).withMessage('Max manual discount must be a positive number'),
  body('max_manual_discount_type')
    .isIn(['fixed', 'percent']).withMessage('Discount type must be fixed or percent'),
  body('surcharge_overlap_mode')
    .optional()
    .isIn(['highest', 'stack']).withMessage('Surcharge overlap mode must be "highest" or "stack"'),
];

/* GET /api/pricing-settings — any authenticated user can read
   (cashiers/managers need this to know the discount cap when creating an order) */
const getPricingSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pricing_settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: { free_delivery_threshold: null, max_manual_discount: 0, max_manual_discount_type: 'fixed' },
      });
    }
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('getPricingSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* PUT /api/pricing-settings — super_admin only */
const updatePricingSettings = async (req, res) => {
  try {
    const { free_delivery_threshold, max_manual_discount, max_manual_discount_type, surcharge_overlap_mode } = req.body;

    const result = await pool.query(
      `UPDATE pricing_settings
       SET free_delivery_threshold = $1,
           max_manual_discount     = $2,
           max_manual_discount_type = $3,
           surcharge_overlap_mode   = $4,
           updated_by = $5,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [free_delivery_threshold || null, max_manual_discount, max_manual_discount_type,
       surcharge_overlap_mode || 'highest', req.user?.id || null]
    );

    if (result.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO pricing_settings (id, free_delivery_threshold, max_manual_discount, max_manual_discount_type, surcharge_overlap_mode, updated_by)
         VALUES (1, $1, $2, $3, $4, $5) RETURNING *`,
        [free_delivery_threshold || null, max_manual_discount, max_manual_discount_type,
         surcharge_overlap_mode || 'highest', req.user?.id || null]
      );
      return res.json({ success: true, message: 'Pricing settings saved', settings: inserted.rows[0] });
    }

    res.json({ success: true, message: 'Pricing settings updated', settings: result.rows[0] });
  } catch (error) {
    console.error('updatePricingSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getPricingSettings, updatePricingSettings, pricingSettingsValidation };
