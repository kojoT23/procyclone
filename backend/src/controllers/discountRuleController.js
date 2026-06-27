const { body } = require('express-validator');
const pool = require('../config/db');

const discountRuleValidation = [
  body('label').notEmpty().withMessage('Label is required').isLength({ max: 100 }),
  body('discount_type').isIn(['fixed', 'percent']).withMessage('Type must be fixed or percent'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('min_order_amount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be a positive number'),
];

const getDiscountRules = async (req, res) => {
  try {
    const { active_only } = req.query;
    const where = active_only === 'true' ? 'WHERE is_active = true' : '';
    const result = await pool.query(`SELECT * FROM discount_rules ${where} ORDER BY min_order_amount ASC`);
    res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error('getDiscountRules error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createDiscountRule = async (req, res) => {
  try {
    const { label, discount_type, discount_value, min_order_amount } = req.body;
    const result = await pool.query(
      `INSERT INTO discount_rules (label, discount_type, discount_value, min_order_amount)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [label, discount_type, discount_value, min_order_amount || 0]
    );
    res.status(201).json({ success: true, message: 'Discount rule created', rule: result.rows[0] });
  } catch (error) {
    console.error('createDiscountRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateDiscountRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, discount_type, discount_value, min_order_amount, is_active } = req.body;
    const result = await pool.query(
      `UPDATE discount_rules
       SET label = $1, discount_type = $2, discount_value = $3, min_order_amount = $4,
           is_active = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [label, discount_type, discount_value, min_order_amount || 0,
       is_active !== undefined ? is_active : true, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discount rule not found' });
    }
    res.json({ success: true, message: 'Discount rule updated', rule: result.rows[0] });
  } catch (error) {
    console.error('updateDiscountRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteDiscountRule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM discount_rules WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discount rule not found' });
    }
    res.json({ success: true, message: `Discount rule "${result.rows[0].label}" deleted` });
  } catch (error) {
    console.error('deleteDiscountRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CALCULATION HELPER — exported for use by orderController.
   Given a subtotal, finds the BEST applicable automatic discount
   (the one giving the largest discount amount, not necessarily the
   highest percentage — a fixed GH₵50 might beat a 5% rule on a
   small order). Only ONE automatic rule applies per order, never
   stacked — this matches typical "best discount applies" retail
   behavior and avoids compounding multiple rules unexpectedly.
───────────────────────────────────────────────────────────────── */
const calculateAutoDiscount = async (subtotal) => {
  const result = await pool.query(
    `SELECT * FROM discount_rules WHERE is_active = true AND min_order_amount <= $1`,
    [subtotal]
  );

  let bestDiscount = 0;
  let bestRule = null;

  for (const rule of result.rows) {
    const amount = rule.discount_type === 'percent'
      ? subtotal * (parseFloat(rule.discount_value) / 100)
      : parseFloat(rule.discount_value);

    if (amount > bestDiscount) {
      bestDiscount = amount;
      bestRule = rule;
    }
  }

  return {
    amount: Math.round(bestDiscount * 100) / 100,
    rule: bestRule, // null if no rule applied — useful for audit/receipt transparency
  };
};

module.exports = {
  getDiscountRules, createDiscountRule, updateDiscountRule, deleteDiscountRule,
  discountRuleValidation, calculateAutoDiscount,
};
