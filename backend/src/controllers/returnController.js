const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   GET /api/returns
   Filters: ?status=, ?refund_status=, ?assigned_to=me
═══════════════════════════════════════════════════════════════ */
const getReturns = async (req, res) => {
  try {
    const { status, refund_status, assigned_to, page = 1, limit = 20 } = req.query;
    const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * lim;

    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`r.status = $${i}`); values.push(status); i++; }
    if (refund_status) { conditions.push(`r.refund_status = $${i}`); values.push(refund_status); i++; }
    if (assigned_to === 'me') { conditions.push(`r.assigned_to = $${i}`); values.push(req.user.id); i++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM order_returns r ${where}`, values);

    const result = await pool.query(
      `SELECT
        r.id, r.order_id, r.item_summary, r.items_detail, r.status, r.reason, r.condition,
        r.enquiry_notes, r.photos, r.photo_url, r.declaration_confirmed, r.quantity_mismatch,
        r.refund_status, r.resolution,
        r.restocked_at, r.enquiry_completed_at, r.disposed_at, r.disposal_notes,
        o.order_number, o.total_amount,
        c.name as customer_name, c.phone as customer_phone,
        ri.name as rider_name,
        au.name as assigned_to_name,
        rb.name as marked_returned_by_name,
        eb.name as enquiry_completed_by_name,
        db.name as disposed_by_name,
        p.method as payment_method, p.amount as payment_amount
       FROM order_returns r
       LEFT JOIN orders o     ON r.order_id = o.id
       LEFT JOIN customers c  ON r.customer_id = c.id
       LEFT JOIN riders ri    ON r.rider_id = ri.id
       LEFT JOIN users au     ON r.assigned_to = au.id
       LEFT JOIN users rb     ON r.restocked_by = rb.id
       LEFT JOIN users eb     ON r.enquiry_completed_by = eb.id
       LEFT JOIN users db     ON r.disposed_by = db.id
       LEFT JOIN payments p   ON r.payment_id = p.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, lim, offset]
    );

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / lim),
      returns: result.rows,
    });
  } catch (error) {
    console.error('getReturns error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/returns/:id/enquiry
   Full accountability form: reason, condition (sellable/damaged/
   missing), notes, 1+ photos, a signed declaration, and a received
   quantity for every item on the return. If any item's received
   quantity is short of what was ordered, the case is ALWAYS escalated
   to disposal approval regardless of the condition selected — a
   shortfall is the strongest signal something didn't come back.
   Sellable + full quantity → restocks immediately, using the
   *received* quantity, not the original order quantity.
═══════════════════════════════════════════════════════════════ */
const submitEnquiry = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason, condition, notes, photos, declaration, items } = req.body;

    if (!reason || !condition || !notes || !declaration) {
      return res.status(400).json({
        success: false,
        message: 'Reason, condition, notes, and the declaration are all required',
      });
    }
    if (!['sellable', 'damaged', 'missing'].includes(condition)) {
      return res.status(400).json({ success: false, message: 'Invalid condition' });
    }
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Received quantities are required for every item' });
    }

    await client.query('BEGIN');

    const ret = await client.query(
      `SELECT * FROM order_returns WHERE id = $1 AND status = 'pending_enquiry'`,
      [id]
    );
    if (ret.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Return not found or enquiry already completed' });
    }

    const isAdmin = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (ret.rows[0].assigned_to !== req.user.id && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'This return is assigned to someone else' });
    }

    // Merge received quantities into the items_detail captured at intake
    const originalItems = ret.rows[0].items_detail || [];
    let quantityMismatch = false;
    const mergedItems = originalItems.map(orig => {
      const submitted = items.find(x => x.product_id === orig.product_id);
      const received = submitted ? parseInt(submitted.quantity_received) : 0;
      if (isNaN(received) || received < 0 || received > orig.quantity_ordered) {
        throw new Error(`Invalid received quantity for ${orig.product_name}`);
      }
      if (received < orig.quantity_ordered) quantityMismatch = true;
      return { ...orig, quantity_received: received };
    });

    // A shortfall forces disposal review no matter what condition was
    // picked — a person can't just mark "sellable" to fast-track a
    // return that's actually missing units.
    const nextStatus = (condition === 'sellable' && !quantityMismatch)
      ? 'resolved' : 'pending_disposal_approval';

    if (nextStatus === 'resolved') {
      for (const item of mergedItems) {
        if (item.quantity_received > 0) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
            [item.quantity_received, item.product_id]
          );
        }
      }
    }

    const updated = await client.query(
      `UPDATE order_returns SET
        reason = $1, condition = $2, enquiry_notes = $3, photos = $4,
        declaration_confirmed = $5, items_detail = $6, quantity_mismatch = $7,
        enquiry_completed_by = $8, enquiry_completed_at = NOW(),
        status = $9, resolution = $10
       WHERE id = $11 RETURNING *`,
      [reason, condition, notes, JSON.stringify(photos), true, JSON.stringify(mergedItems),
       quantityMismatch, req.user.id, nextStatus,
       nextStatus === 'resolved' ? 'restocked' : null, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Enquiry submitted', return: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('submitEnquiry error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/returns/:id/disposal
   Admin/manager only. Restocks (if overridden) using the RECEIVED
   quantity from items_detail, not the original order quantity.
═══════════════════════════════════════════════════════════════ */
const approveDisposal = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { resolution, notes } = req.body;

    if (!['written_off', 'returned_to_supplier', 'restocked_after_review'].includes(resolution)) {
      return res.status(400).json({ success: false, message: 'Invalid resolution' });
    }
    if (!notes) {
      return res.status(400).json({ success: false, message: 'Disposal notes are required' });
    }

    await client.query('BEGIN');

    const ret = await client.query(
      `SELECT * FROM order_returns WHERE id = $1 AND status = 'pending_disposal_approval'`,
      [id]
    );
    if (ret.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Return not found or not awaiting disposal approval' });
    }

    if (resolution === 'restocked_after_review') {
      const itemsDetail = ret.rows[0].items_detail || [];
      for (const item of itemsDetail) {
        const qty = item.quantity_received ?? item.quantity_ordered;
        if (qty > 0) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
            [qty, item.product_id]
          );
        }
      }
    }

    const updated = await client.query(
      `UPDATE order_returns SET
        status = 'resolved', resolution = $1, disposal_notes = $2,
        disposed_by = $3, disposed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [resolution, notes, req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Disposal recorded', return: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('approveDisposal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/returns/:id/refund
═══════════════════════════════════════════════════════════════ */
const confirmReturnRefund = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const ret = await client.query(
      `SELECT * FROM order_returns WHERE id = $1 AND refund_status = 'pending'`,
      [id]
    );
    if (ret.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Return not found or not pending refund' });
    }

    const updated = await client.query(
      `UPDATE order_returns SET refund_status = 'refunded',
        refund_confirmed_by = $1, refund_confirmed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, id]
    );

    if (ret.rows[0].payment_id) {
      await client.query(
        `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [ret.rows[0].payment_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Refund confirmed', return: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('confirmReturnRefund error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { getReturns, submitEnquiry, approveDisposal, confirmReturnRefund };
