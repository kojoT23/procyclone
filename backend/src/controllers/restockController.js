const pool = require('../config/db');

// Anyone authenticated can flag a product as needing restock — this is
// meant to be low-friction (a field agent noticing low stock), not a
// formal purchase order. createPurchaseOrder in inventoryController.js
// already covers the actual ordering process.
const createRestockRequest = async (req, res) => {
  try {
    const { product_id, quantity_needed, note } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required' });
    }
    const product = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const result = await pool.query(
      `INSERT INTO restock_requests (product_id, requested_by, quantity_needed, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [product_id, req.user?.id, quantity_needed || null, note || null]
    );
    res.status(201).json({ success: true, message: 'Restock request sent', restock_request: result.rows[0] });
  } catch (error) {
    console.error('createRestockRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Viewing/managing the queue is restricted — same roles as inventory
// management (super_admin, admin, manager, warehouse).
// Anyone can see their own requests (so a field agent can check "did
// anyone act on this?"). Seeing the FULL queue across everyone is
// restricted to inventory-managing roles, enforced by scoping the query
// rather than blocking the route entirely — see the role check below.
const PRIVILEGED_ROLES = ['super_admin', 'admin', 'manager', 'warehouse'];

const getRestockRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`rr.status = $${i++}`); values.push(status); }

    if (!PRIVILEGED_ROLES.includes(req.user?.role)) {
      conditions.push(`rr.requested_by = $${i++}`);
      values.push(req.user?.id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM restock_requests rr ${where}`, values);
    const result = await pool.query(
      `SELECT rr.*, p.name as product_name, p.stock_quantity as current_stock, u.name as requested_by_name
       FROM restock_requests rr
       LEFT JOIN products p ON rr.product_id = p.id
       LEFT JOIN users u ON rr.requested_by = u.id
       ${where} ORDER BY rr.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      restock_requests: result.rows,
    });
  } catch (error) {
    console.error('getRestockRequests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateRestockRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'ordered', 'fulfilled', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    const result = await pool.query(
      'UPDATE restock_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restock request not found' });
    }
    res.json({ success: true, message: 'Restock request updated', restock_request: result.rows[0] });
  } catch (error) {
    console.error('updateRestockRequestStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createRestockRequest, getRestockRequests, updateRestockRequestStatus };
