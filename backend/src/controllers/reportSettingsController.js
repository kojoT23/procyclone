const pool = require('../config/db');

/**
 * GET /api/report-settings
 * Returns every setting as a flat { key: value } map, plus metadata
 * (description, when it was last updated, by whom) for display in the
 * Settings panel. Nothing here is hardcoded — this table is the single
 * source of truth for every configurable number used across the Reports Hub.
 */
const getSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rs.setting_key, rs.setting_value, rs.setting_text, rs.description,
              rs.updated_at, u.name as updated_by_name
       FROM report_settings rs
       LEFT JOIN users u ON rs.updated_by = u.id
       ORDER BY rs.id`
    );

    res.json({ success: true, settings: result.rows });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/report-settings
 * Body: { settings: { vat_rate_percent: 12.5, monthly_revenue_budget: 50000, ... } }
 * Upserts each provided key. Only keys that already exist as rows are updated —
 * this endpoint never silently creates new setting types, to avoid typos
 * quietly introducing an unused setting.
 *
 * TODO(samuel): plug in your existing role-check middleware here so only
 * manager/owner accounts can change these — let me know the name of the
 * middleware you use elsewhere (e.g. requirePermission('manage_settings'))
 * and I'll wire it into the route directly instead of leaving this open.
 */
const updateSettings = async (req, res) => {
  const { settings } = req.body;
  const userId = req.user?.id || null;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: 'settings object is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = [];
    for (const [key, value] of Object.entries(settings)) {
      const isNumeric = typeof value === 'number' || (!isNaN(parseFloat(value)) && value !== '');

      const result = await client.query(
        `UPDATE report_settings
         SET setting_value = $1,
             setting_text = $2,
             updated_by = $3,
             updated_at = NOW()
         WHERE setting_key = $4
         RETURNING setting_key, setting_value, setting_text`,
        [
          isNumeric ? parseFloat(value) : null,
          isNumeric ? null : String(value),
          userId,
          key,
        ]
      );

      if (result.rows.length === 0) {
        // Key doesn't exist in the table — skip rather than insert silently.
        continue;
      }
      updated.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.json({ success: true, updated });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { getSettings, updateSettings };
