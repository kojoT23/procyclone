const { body } = require('express-validator');
const pool = require('../config/db');

const surchargeRuleValidation = [
  body('label').notEmpty().withMessage('Label is required').isLength({ max: 100 }),
  body('day_of_week')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 6 }).withMessage('Day of week must be 0 (Sunday) through 6 (Saturday)'),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Start time must be HH:MM'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('End time must be HH:MM'),
  body('surcharge_type').isIn(['fixed', 'percent']).withMessage('Type must be fixed or percent'),
  body('surcharge_value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
];

/* ── GET /api/surcharge-rules — any authenticated user can read ── */
const getSurchargeRules = async (req, res) => {
  try {
    const { active_only } = req.query;
    const where = active_only === 'true' ? 'WHERE is_active = true' : '';
    const result = await pool.query(`SELECT * FROM surcharge_rules ${where} ORDER BY day_of_week NULLS FIRST, start_time`);
    res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error('getSurchargeRules error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/surcharge-rules — super_admin only ── */
const createSurchargeRule = async (req, res) => {
  try {
    const { label, day_of_week, start_time, end_time, surcharge_type, surcharge_value } = req.body;
    const result = await pool.query(
      `INSERT INTO surcharge_rules (label, day_of_week, start_time, end_time, surcharge_type, surcharge_value)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [label, day_of_week ?? null, start_time, end_time, surcharge_type, surcharge_value]
    );
    res.status(201).json({ success: true, message: 'Surcharge rule created', rule: result.rows[0] });
  } catch (error) {
    console.error('createSurchargeRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── PUT /api/surcharge-rules/:id — super_admin only ── */
const updateSurchargeRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, day_of_week, start_time, end_time, surcharge_type, surcharge_value, is_active } = req.body;
    const result = await pool.query(
      `UPDATE surcharge_rules
       SET label = $1, day_of_week = $2, start_time = $3, end_time = $4,
           surcharge_type = $5, surcharge_value = $6,
           is_active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [label, day_of_week ?? null, start_time, end_time, surcharge_type, surcharge_value,
       is_active !== undefined ? is_active : true, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Surcharge rule not found' });
    }
    res.json({ success: true, message: 'Surcharge rule updated', rule: result.rows[0] });
  } catch (error) {
    console.error('updateSurchargeRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── DELETE /api/surcharge-rules/:id — super_admin only.
   Hard delete is fine here (unlike zones) — surcharge_applied on past
   orders is just a stored number, not a foreign key reference, so
   removing a rule doesn't break historical order data. ── */
const deleteSurchargeRule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM surcharge_rules WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Surcharge rule not found' });
    }
    res.json({ success: true, message: `Surcharge rule "${result.rows[0].label}" deleted` });
  } catch (error) {
    console.error('deleteSurchargeRule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CALCULATION HELPER — exported for use by orderController.
   Given a JS Date, finds any active surcharge rule whose day/time
   window currently applies, and returns the surcharge amount for
   a given base fee. If multiple rules match, the LARGEST surcharge
   wins (most conservative for the business — never undercharge).

   Handles windows that cross midnight: if end_time < start_time,
   the window is interpreted as spanning into the next calendar day.
───────────────────────────────────────────────────────────────── */
const calculateSurcharge = async (baseFee, atDate = new Date()) => {
  const dayOfWeek = atDate.getDay(); // 0=Sunday..6=Saturday, matches our schema
  const currentTime = atDate.toTimeString().slice(0, 8); // "HH:MM:SS"

  const [rulesResult, settingsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM surcharge_rules
       WHERE is_active = true
         AND (day_of_week IS NULL OR day_of_week = $1)`,
      [dayOfWeek]
    ),
    pool.query('SELECT surcharge_overlap_mode FROM pricing_settings WHERE id = 1'),
  ]);

  const overlapMode = settingsResult.rows[0]?.surcharge_overlap_mode || 'highest';
  const matchingSurcharges = [];

  for (const rule of rulesResult.rows) {
    const start = rule.start_time;
    const end   = rule.end_time;

    let inWindow;
    if (start <= end) {
      // Normal window, e.g. 14:00–18:00
      inWindow = currentTime >= start && currentTime < end;
    } else {
      // Crosses midnight, e.g. 20:00–02:00
      inWindow = currentTime >= start || currentTime < end;
    }

    if (inWindow) {
      const surcharge = rule.surcharge_type === 'percent'
        ? baseFee * (parseFloat(rule.surcharge_value) / 100)
        : parseFloat(rule.surcharge_value);
      matchingSurcharges.push(surcharge);
    }
  }

  if (matchingSurcharges.length === 0) return 0;

  const total = overlapMode === 'stack'
    ? matchingSurcharges.reduce((sum, s) => sum + s, 0)
    : Math.max(...matchingSurcharges);

  return Math.round(total * 100) / 100; // round to 2 decimal places
};

module.exports = {
  getSurchargeRules, createSurchargeRule, updateSurchargeRule, deleteSurchargeRule,
  surchargeRuleValidation, calculateSurcharge,
};
