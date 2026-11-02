const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   POST /api/assistance — PUBLIC, no login. A customer in Store Mode
   taps "Call an Assistant" and optionally picks/types a reason. No
   customer identity needed — a teller just needs to know someone at
   a kiosk wants help, same trust level as self-checkout.
═══════════════════════════════════════════════════════════════ */
const createRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await pool.query(
      `INSERT INTO assistance_requests (reason) VALUES ($1) RETURNING *`,
      [reason || null]
    );
    res.status(201).json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('createRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/assistance?status=pending — STAFF ONLY. Powers the
   Assistance Requests tab, same polling pattern as self-checkout
   tickets. status is optional; omit it to see everything.
═══════════════════════════════════════════════════════════════ */
const getRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const result = status
      ? await pool.query('SELECT * FROM assistance_requests WHERE status = $1 ORDER BY requested_at ASC', [status])
      : await pool.query('SELECT * FROM assistance_requests ORDER BY requested_at DESC LIMIT 100');
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/assistance/:id/acknowledge — STAFF ONLY. A teller taps
   this the moment they're heading over, so other staff (and the
   dashboard badge count) see it's already being handled.
═══════════════════════════════════════════════════════════════ */
const acknowledgeRequest = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE assistance_requests
       SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or already handled' });
    }
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('acknowledgeRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   PUT /api/assistance/:id/resolve — STAFF ONLY. Marks it done;
   works whether or not it was acknowledged first (a teller might
   just resolve it directly on the spot).
═══════════════════════════════════════════════════════════════ */
const resolveRequest = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE assistance_requests
       SET status = 'resolved', resolved_at = NOW(), resolved_by = $1
       WHERE id = $2 AND status != 'resolved'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or already resolved' });
    }
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('resolveRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createRequest, getRequests, acknowledgeRequest, resolveRequest };
