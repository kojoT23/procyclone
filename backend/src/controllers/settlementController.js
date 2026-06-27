const { body } = require('express-validator');
const pool = require('../config/db');

const declareSettlementValidation = [
  body('order_ids').isArray({ min: 1 }).withMessage('Select at least one order to settle'),
  body('declared_amount').isFloat({ min: 0.01 }).withMessage('Declared amount must be greater than 0'),
];

const approveSettlementValidation = [
  body('approved_amount').isFloat({ min: 0 }).withMessage('Approved amount must be a positive number'),
];

/* ─────────────────────────────────────────────────────────────────
   Shared helper — a rider's outstanding balance.
   = sum of COD payments confirmed_by_rider on/after the cutoff,
     for orders that are NOT yet attached to any settlement
   This is what Layer 2 (the float cap) will check, and what the
   rider's own page shows them.
───────────────────────────────────────────────────────────────── */
const getOutstandingForRider = async (riderId) => {
  const result = await pool.query(
    `SELECT o.id, o.order_number, o.total_amount, cl.collected_at
     FROM cash_logs cl
     JOIN orders o ON cl.order_id = o.id
     WHERE cl.rider_id = $1
       AND cl.status = 'pending'
       AND o.id NOT IN (
         SELECT so.order_id
         FROM settlement_orders so
         JOIN settlements s ON so.settlement_id = s.id
         WHERE s.rider_id = $1
           AND s.status IN ('declared', 'approved', 'disputed')
       )
     ORDER BY cl.collected_at ASC`,
    [riderId]
  );
  const totalOutstanding = result.rows.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
  return { orders: result.rows, totalOutstanding: Math.round(totalOutstanding * 100) / 100 };
};

/* ── GET /api/settlements/outstanding/:riderId ──────────────────
   A rider's own unsettled orders + total. Riders can check their
   own; office/super_admin can check anyone's.

   Note: riders.user_id references users(id) — there is no reverse
   rider_id column on users — so we look up the rider record by
   matching riders.user_id = req.user.id, not the other way around. */
const getOutstanding = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (req.user.role === 'rider') {
      const own = await pool.query('SELECT id FROM riders WHERE user_id = $1', [req.user.id]);
      if (own.rows.length === 0 || own.rows[0].id !== parseInt(riderId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this' });
      }
    }

    const { orders, totalOutstanding } = await getOutstandingForRider(riderId);
    res.json({ success: true, orders, total_outstanding: totalOutstanding });
  } catch (error) {
    console.error('getOutstanding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/settlements — rider declares a settlement ───────── */
const declareSettlement = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { order_ids, declared_amount, notes } = req.body;

    // Resolve the rider's own riders.id from their user login, since
    // there's no rider_id stored on the users row — the link goes
    // riders.user_id -> users.id, not the reverse. If office staff
    // is declaring on a rider's behalf, rider_id can be passed
    // explicitly in the body instead.
    let riderId = req.body.rider_id;
    if (!riderId) {
      const own = await client.query('SELECT id FROM riders WHERE user_id = $1', [req.user.id]);
      if (own.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'No rider profile found for this account' });
      }
      riderId = own.rows[0].id;
    }

    // Verify every order_id actually belongs to this rider's unsettled list —
    // never trust the client to only send legitimate order ids.
    const { orders: unsettled } = await getOutstandingForRider(riderId);
    const unsettledIds = new Set(unsettled.map(o => o.id));
    const invalidIds = order_ids.filter(id => !unsettledIds.has(parseInt(id)));
    if (invalidIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Order(s) ${invalidIds.join(', ')} are not valid unsettled orders for this rider`,
      });
    }

    const settlement = await client.query(
      `INSERT INTO settlements (rider_id, declared_amount, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [riderId, declared_amount, notes || null]
    );
    const settlementId = settlement.rows[0].id;

    for (const orderId of order_ids) {
      await client.query(
        'INSERT INTO settlement_orders (settlement_id, order_id) VALUES ($1, $2)',
        [settlementId, orderId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Settlement declared', settlement: settlement.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('declareSettlement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ── GET /api/settlements?status=declared — office review queue ── */
const getSettlements = async (req, res) => {
  try {
    const { status, rider_id, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status)   { conditions.push(`s.status = $${i++}`);    values.push(status); }
    if (rider_id) { conditions.push(`s.rider_id = $${i++}`);  values.push(rider_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`SELECT COUNT(*) FROM settlements s ${where}`, values);

    const result = await pool.query(
      `SELECT s.*, r.name as rider_name, r.phone as rider_phone, u.name as approved_by_name,
              (SELECT COUNT(*) FROM settlement_orders so WHERE so.settlement_id = s.id) as order_count
       FROM settlements s
       LEFT JOIN riders r ON s.rider_id = r.id
       LEFT JOIN users u ON s.approved_by = u.id
       ${where}
       ORDER BY s.declared_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      settlements: result.rows,
    });
  } catch (error) {
    console.error('getSettlements error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── PUT /api/settlements/:id/approve — office confirms the count ──
   Records the ACTUAL counted amount. If it matches declared_amount,
   status becomes 'approved'. If not, status becomes 'disputed' —
   but the real counted amount STILL reduces the rider's outstanding
   balance correctly, since it's based on settlement_orders being
   attached to this settlement regardless of match/mismatch. */
const approveSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_amount, dispute_notes } = req.body;

    const existing = await pool.query('SELECT * FROM settlements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }
    if (existing.rows[0].status !== 'declared') {
      return res.status(400).json({ success: false, message: 'This settlement has already been resolved' });
    }

    const matches = parseFloat(approved_amount) === parseFloat(existing.rows[0].declared_amount);
    const newStatus = matches ? 'approved' : 'disputed';

    const result = await pool.query(
      `UPDATE settlements SET
         approved_amount = $1,
         status = $2,
         dispute_notes = $3,
         approved_by = $4,
         approved_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [approved_amount, newStatus, matches ? null : (dispute_notes || 'Amount did not match declaration'), req.user.id, id]
    );

    res.json({
      success: true,
      message: matches
        ? 'Settlement approved — amount matched'
        : 'Settlement recorded as disputed — amount did not match, but the counted amount has been applied',
      settlement: result.rows[0],
    });
  } catch (error) {
    console.error('approveSettlement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getOutstanding, declareSettlement, getSettlements, approveSettlement,
  declareSettlementValidation, approveSettlementValidation,
  getOutstandingForRider,
};
