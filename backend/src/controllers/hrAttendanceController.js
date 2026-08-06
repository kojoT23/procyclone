const pool = require('../config/db');

const today = () => new Date().toISOString().split('T')[0];

// ── Clock In ─────────────────────────────────────────────────
const clockIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const workDate = today();

    const open = await pool.query(
      `SELECT id FROM staff_attendance WHERE user_id = $1 AND work_date = $2 AND status = 'clocked_in'`,
      [userId, workDate]
    );
    if (open.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'You are already clocked in' });
    }

    const result = await pool.query(
      `INSERT INTO staff_attendance (user_id, work_date, clock_in_at, status)
       VALUES ($1, $2, NOW(), 'clocked_in') RETURNING *`,
      [userId, workDate]
    );
    res.status(201).json({ success: true, message: 'Clocked in', attendance: result.rows[0] });
  } catch (error) {
    console.error('clockIn error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Clock Out ────────────────────────────────────────────────
const clockOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const workDate = today();

    const open = await pool.query(
      `SELECT * FROM staff_attendance WHERE user_id = $1 AND work_date = $2 AND status = 'clocked_in'`,
      [userId, workDate]
    );
    if (open.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'You are not clocked in' });
    }
    const attendance = open.rows[0];

    const openBreak = await pool.query(
      `SELECT id FROM staff_breaks WHERE attendance_id = $1 AND end_at IS NULL`,
      [attendance.id]
    );
    if (openBreak.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Please end your break before clocking out' });
    }

    const breakTotal = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total FROM staff_breaks WHERE attendance_id = $1`,
      [attendance.id]
    );
    const clockInAt = new Date(attendance.clock_in_at);
    const clockOutAt = new Date();
    const grossMinutes = Math.round((clockOutAt - clockInAt) / 60000);
    const totalMinutes = Math.max(0, grossMinutes - parseInt(breakTotal.rows[0].total));

    const result = await pool.query(
      `UPDATE staff_attendance SET clock_out_at = NOW(), total_minutes = $1, status = 'clocked_out', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [totalMinutes, attendance.id]
    );
    res.json({ success: true, message: 'Clocked out', attendance: result.rows[0] });
  } catch (error) {
    console.error('clockOut error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Start Break ──────────────────────────────────────────────
const startBreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const { break_type } = req.body;
    const workDate = today();

    const open = await pool.query(
      `SELECT * FROM staff_attendance WHERE user_id = $1 AND work_date = $2 AND status = 'clocked_in'`,
      [userId, workDate]
    );
    if (open.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'You must be clocked in to start a break' });
    }
    const attendance = open.rows[0];

    const existingBreak = await pool.query(
      `SELECT id FROM staff_breaks WHERE attendance_id = $1 AND end_at IS NULL`,
      [attendance.id]
    );
    if (existingBreak.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'You are already on a break' });
    }

    const validTypes = ['lunch', 'short'];
    const type = validTypes.includes(break_type) ? break_type : 'short';

    const result = await pool.query(
      `INSERT INTO staff_breaks (attendance_id, break_type, start_at) VALUES ($1, $2, NOW()) RETURNING *`,
      [attendance.id, type]
    );
    res.status(201).json({ success: true, message: 'Break started', break: result.rows[0] });
  } catch (error) {
    console.error('startBreak error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── End Break ────────────────────────────────────────────────
const endBreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const workDate = today();

    const open = await pool.query(
      `SELECT * FROM staff_attendance WHERE user_id = $1 AND work_date = $2 AND status = 'clocked_in'`,
      [userId, workDate]
    );
    if (open.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'You are not clocked in' });
    }
    const attendance = open.rows[0];

    const openBreakRes = await pool.query(
      `SELECT * FROM staff_breaks WHERE attendance_id = $1 AND end_at IS NULL`,
      [attendance.id]
    );
    if (openBreakRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'You are not on a break' });
    }
    const brk = openBreakRes.rows[0];
    const startAt = new Date(brk.start_at);
    const endAt = new Date();
    const durationMinutes = Math.max(0, Math.round((endAt - startAt) / 60000));

    const result = await pool.query(
      `UPDATE staff_breaks SET end_at = NOW(), duration_minutes = $1 WHERE id = $2 RETURNING *`,
      [durationMinutes, brk.id]
    );
    res.json({ success: true, message: 'Break ended', break: result.rows[0] });
  } catch (error) {
    console.error('endBreak error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── My current status (for the clock-in/out widget) ───────────
const getMyStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const workDate = today();

    const attendanceRes = await pool.query(
      `SELECT * FROM staff_attendance WHERE user_id = $1 AND work_date = $2 ORDER BY clock_in_at DESC LIMIT 1`,
      [userId, workDate]
    );
    const attendance = attendanceRes.rows[0] || null;

    let openBreak = null;
    let breaks = [];
    if (attendance) {
      const breaksRes = await pool.query(
        `SELECT * FROM staff_breaks WHERE attendance_id = $1 ORDER BY start_at ASC`,
        [attendance.id]
      );
      breaks = breaksRes.rows;
      openBreak = breaks.find(b => !b.end_at) || null;
    }

    res.json({ success: true, attendance, open_break: openBreak, breaks });
  } catch (error) {
    console.error('getMyStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── My attendance history ──────────────────────────────────────
const getMyHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30 } = req.query;
    const result = await pool.query(
      `SELECT * FROM staff_attendance WHERE user_id = $1 ORDER BY work_date DESC LIMIT $2`,
      [userId, limit]
    );
    res.json({ success: true, records: result.rows });
  } catch (error) {
    console.error('getMyHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: all staff attendance (for reporting) ─────────────────
const getAllAttendance = async (req, res) => {
  try {
    const { date, user_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (date) { conditions.push(`sa.work_date = $${i++}`); values.push(date); }
    if (user_id) { conditions.push(`sa.user_id = $${i++}`); values.push(user_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM staff_attendance sa ${where}`, values);
    const result = await pool.query(
      `SELECT sa.*, u.name as user_name, u.role as user_role
       FROM staff_attendance sa
       JOIN users u ON sa.user_id = u.id
       ${where} ORDER BY sa.work_date DESC, sa.clock_in_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      records: result.rows,
    });
  } catch (error) {
    console.error('getAllAttendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getMyStatus,
  getMyHistory,
  getAllAttendance,
};
