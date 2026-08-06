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
  body([
    'default_import_duty_pct', 'default_ecowas_levy_pct', 'default_au_levy_pct',
    'default_exim_levy_pct', 'default_processing_fee_pct', 'default_vat_pct',
    'default_nhil_pct', 'default_getfund_pct', 'default_clearing_agent_pct',
  ])
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('default_clearing_agent_min')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Clearing agent minimum must be a positive number'),
];

/* GET /api/pricing-settings — any authenticated user can read
   (cashiers/managers need this to know the discount cap when creating an order) */
const getPricingSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pricing_settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          free_delivery_threshold: null, max_manual_discount: 0, max_manual_discount_type: 'fixed',
          default_import_duty_pct: 20, default_ecowas_levy_pct: 0.5, default_au_levy_pct: 0.2,
          default_exim_levy_pct: 0.75, default_processing_fee_pct: 1, default_vat_pct: 15,
          default_nhil_pct: 2.5, default_getfund_pct: 2.5, default_clearing_agent_pct: 0,
          default_clearing_agent_min: 0,
        },
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
    const {
      free_delivery_threshold, max_manual_discount, max_manual_discount_type, surcharge_overlap_mode,
      default_import_duty_pct, default_ecowas_levy_pct, default_au_levy_pct, default_exim_levy_pct,
      default_processing_fee_pct, default_vat_pct, default_nhil_pct, default_getfund_pct,
      default_clearing_agent_pct, default_clearing_agent_min,
    } = req.body;

    const graDefaults = [
      default_import_duty_pct ?? 20, default_ecowas_levy_pct ?? 0.5, default_au_levy_pct ?? 0.2,
      default_exim_levy_pct ?? 0.75, default_processing_fee_pct ?? 1, default_vat_pct ?? 15,
      default_nhil_pct ?? 2.5, default_getfund_pct ?? 2.5, default_clearing_agent_pct ?? 0,
      default_clearing_agent_min ?? 0,
    ];

    const result = await pool.query(
      `UPDATE pricing_settings
       SET free_delivery_threshold = $1,
           max_manual_discount     = $2,
           max_manual_discount_type = $3,
           surcharge_overlap_mode   = $4,
           default_import_duty_pct = $5,
           default_ecowas_levy_pct = $6,
           default_au_levy_pct = $7,
           default_exim_levy_pct = $8,
           default_processing_fee_pct = $9,
           default_vat_pct = $10,
           default_nhil_pct = $11,
           default_getfund_pct = $12,
           default_clearing_agent_pct = $13,
           default_clearing_agent_min = $14,
           updated_by = $15,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [free_delivery_threshold || null, max_manual_discount, max_manual_discount_type,
       surcharge_overlap_mode || 'highest', ...graDefaults, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO pricing_settings
          (id, free_delivery_threshold, max_manual_discount, max_manual_discount_type, surcharge_overlap_mode,
           default_import_duty_pct, default_ecowas_levy_pct, default_au_levy_pct, default_exim_levy_pct,
           default_processing_fee_pct, default_vat_pct, default_nhil_pct, default_getfund_pct,
           default_clearing_agent_pct, default_clearing_agent_min, updated_by)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [free_delivery_threshold || null, max_manual_discount, max_manual_discount_type,
         surcharge_overlap_mode || 'highest', ...graDefaults, req.user?.id || null]
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
