const pool = require('../config/db');

const VALID_TYPES = ['annual', 'sick', 'unpaid', 'other'];

// ── My leave requests (self-service) ─────────────────────────────
const getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('getMyLeaveRequests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Submit a new leave request ────────────────────────────────────
const createLeaveRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'leave_type, start_date and end_date are required' });
    }
    if (!VALID_TYPES.includes(leave_type)) {
      return res.status(400).json({ success: false, message: `leave_type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (start_date > end_date) {
      return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date' });
    }

    const result = await pool.query(
      `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, leave_type, start_date, end_date, reason || null]
    );
    res.status(201).json({ success: true, message: 'Leave request submitted', request: result.rows[0] });
  } catch (error) {
    console.error('createLeaveRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Cancel my own pending request ─────────────────────────────────
const cancelMyLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      `DELETE FROM leave_requests WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending request not found (already reviewed, or not yours)' });
    }
    res.json({ success: true, message: 'Leave request cancelled' });
  } catch (error) {
    console.error('cancelMyLeaveRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: list all requests ──────────────────────────────────────
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, user_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status)  { conditions.push(`lr.status = $${i++}`); values.push(status); }
    if (user_id) { conditions.push(`lr.user_id = $${i++}`); values.push(user_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM leave_requests lr ${where}`, values);
    const result = await pool.query(
      `SELECT lr.*, u.name as user_name, u.role as user_role, a.name as approved_by_name
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users a ON lr.approved_by = a.id
       ${where} ORDER BY
         CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END,
         lr.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      requests: result.rows,
    });
  } catch (error) {
    console.error('getAllLeaveRequests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: approve ─────────────────────────────────────────────────
const approveLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }
    res.json({ success: true, message: 'Leave request approved', request: result.rows[0] });
  } catch (error) {
    console.error('approveLeaveRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: reject ──────────────────────────────────────────────────
const rejectLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }
    res.json({ success: true, message: 'Leave request rejected', request: result.rows[0] });
  } catch (error) {
    console.error('rejectLeaveRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyLeaveRequests,
  createLeaveRequest,
  cancelMyLeaveRequest,
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
};
