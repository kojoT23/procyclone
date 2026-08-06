const pool = require('../config/db');

// ── My upcoming/past shifts (self-service) ──────────────────────
const getMyShifts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;
    const conditions = ['user_id = $1'];
    const values = [userId];
    let i = 2;

    if (from) { conditions.push(`shift_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`shift_date <= $${i++}`); values.push(to); }

    const result = await pool.query(
      `SELECT * FROM staff_shifts WHERE ${conditions.join(' AND ')} ORDER BY shift_date ASC, start_time ASC`,
      values
    );
    res.json({ success: true, shifts: result.rows });
  } catch (error) {
    console.error('getMyShifts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: all shifts, filterable ────────────────────────────────
const getAllShifts = async (req, res) => {
  try {
    const { user_id, from, to, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (user_id) { conditions.push(`ss.user_id = $${i++}`); values.push(user_id); }
    if (from)    { conditions.push(`ss.shift_date >= $${i++}`); values.push(from); }
    if (to)      { conditions.push(`ss.shift_date <= $${i++}`); values.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM staff_shifts ss ${where}`, values);
    const result = await pool.query(
      `SELECT ss.*, u.name as user_name, u.role as user_role
       FROM staff_shifts ss
       JOIN users u ON ss.user_id = u.id
       ${where} ORDER BY ss.shift_date ASC, ss.start_time ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      shifts: result.rows,
    });
  } catch (error) {
    console.error('getAllShifts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: create a shift ────────────────────────────────────────
const createShift = async (req, res) => {
  try {
    const { user_id, shift_date, start_time, end_time, role_label, notes } = req.body;
    if (!user_id || !shift_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'user_id, shift_date, start_time and end_time are required' });
    }
    if (start_time >= end_time) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    const result = await pool.query(
      `INSERT INTO staff_shifts (user_id, shift_date, start_time, end_time, role_label, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, shift_date, start_time, end_time, role_label || null, notes || null, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Shift created', shift: result.rows[0] });
  } catch (error) {
    console.error('createShift error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: update a shift ────────────────────────────────────────
const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift_date, start_time, end_time, role_label, notes } = req.body;

    if (start_time && end_time && start_time >= end_time) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    const result = await pool.query(
      `UPDATE staff_shifts SET
       shift_date  = COALESCE($1, shift_date),
       start_time  = COALESCE($2, start_time),
       end_time    = COALESCE($3, end_time),
       role_label  = COALESCE($4, role_label),
       notes       = COALESCE($5, notes),
       updated_at  = NOW()
       WHERE id = $6 RETURNING *`,
      [shift_date, start_time, end_time, role_label, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }
    res.json({ success: true, message: 'Shift updated', shift: result.rows[0] });
  } catch (error) {
    console.error('updateShift error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: delete a shift ────────────────────────────────────────
const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM staff_shifts WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }
    res.json({ success: true, message: 'Shift deleted' });
  } catch (error) {
    console.error('deleteShift error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyShifts,
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
};
