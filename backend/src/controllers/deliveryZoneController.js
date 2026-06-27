const { body } = require('express-validator');
const pool = require('../config/db');

const zoneValidation = [
  body('name').notEmpty().withMessage('Zone name is required').isLength({ max: 100 }),
  body('fee').isFloat({ min: 0 }).withMessage('Fee must be a positive number'),
  body('min_order_amount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be a positive number'),
];

/* GET /api/delivery-zones — any authenticated user can read (needed at order-creation time) */
const getZones = async (req, res) => {
  try {
    const { active_only } = req.query;
    const where = active_only === 'true' ? 'WHERE is_active = true' : '';
    const result = await pool.query(`SELECT * FROM delivery_zones ${where} ORDER BY name ASC`);
    res.json({ success: true, zones: result.rows });
  } catch (error) {
    console.error('getZones error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* POST /api/delivery-zones — super_admin only */
const createZone = async (req, res) => {
  try {
    const { name, fee, min_order_amount } = req.body;
    const result = await pool.query(
      `INSERT INTO delivery_zones (name, fee, min_order_amount) VALUES ($1, $2, $3) RETURNING *`,
      [name, fee, min_order_amount || 0]
    );
    res.status(201).json({ success: true, message: 'Zone created', zone: result.rows[0] });
  } catch (error) {
    console.error('createZone error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* PUT /api/delivery-zones/:id — super_admin only */
const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fee, min_order_amount, is_active } = req.body;
    const result = await pool.query(
      `UPDATE delivery_zones
       SET name = $1, fee = $2, min_order_amount = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, fee, min_order_amount || 0, is_active !== undefined ? is_active : true, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    res.json({ success: true, message: 'Zone updated', zone: result.rows[0] });
  } catch (error) {
    console.error('updateZone error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* DELETE /api/delivery-zones/:id — super_admin only.
   Soft-delete via is_active rather than a hard DELETE — orders that
   already reference this zone (delivery_zone_id FK) must keep working;
   a hard delete would either fail (FK constraint) or orphan old orders. */
const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE delivery_zones SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    res.json({ success: true, message: `Zone "${result.rows[0].name}" deactivated`, zone: result.rows[0] });
  } catch (error) {
    console.error('deleteZone error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getZones, createZone, updateZone, deleteZone, zoneValidation };
