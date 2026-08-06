const pool = require('../config/db');

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

// ── My career profile (tenure summary) ───────────────────────────
const getMyCareerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await pool.query(
      `SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRes.rows[0];

    const tenureDays = Math.floor((new Date() - new Date(user.created_at)) / 86400000);

    const attendanceStats = await pool.query(
      `SELECT COUNT(*) as total_days, COALESCE(SUM(total_minutes), 0) as total_minutes
       FROM staff_attendance WHERE user_id = $1 AND status = 'clocked_out'`,
      [userId]
    );

    res.json({
      success: true,
      profile: {
        ...user,
        tenure_days: tenureDays,
        total_days_worked: parseInt(attendanceStats.rows[0].total_days),
        total_hours_worked: Math.round(parseInt(attendanceStats.rows[0].total_minutes) / 60),
      },
    });
  } catch (error) {
    console.error('getMyCareerProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── List vacancies ─────────────────────────────────────────────────
const getVacancies = async (req, res) => {
  try {
    const { status } = req.query;
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    const conditions = [];
    const values = [];
    let i = 1;

    // Non-admins only ever see open vacancies, regardless of query param
    if (!isAdmin) {
      conditions.push(`status = 'open'`);
    } else if (status) {
      conditions.push(`status = $${i++}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT jv.*, u.name as posted_by_name,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.vacancy_id = jv.id) as application_count
       FROM job_vacancies jv
       LEFT JOIN users u ON jv.posted_by = u.id
       ${where} ORDER BY jv.posted_at DESC`,
      values
    );
    res.json({ success: true, vacancies: result.rows });
  } catch (error) {
    console.error('getVacancies error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: create vacancy ───────────────────────────────────────────
const createVacancy = async (req, res) => {
  try {
    const { title, department, location, employment_type, description, requirements, closes_at } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const result = await pool.query(
      `INSERT INTO job_vacancies (title, department, location, employment_type, description, requirements, closes_at, posted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, department || null, location || null, employment_type || 'full_time', description || null, requirements || null, closes_at || null, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Vacancy posted', vacancy: result.rows[0] });
  } catch (error) {
    console.error('createVacancy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: close/reopen vacancy ─────────────────────────────────────
const updateVacancyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'open' or 'closed'" });
    }
    const result = await pool.query(
      `UPDATE job_vacancies SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vacancy not found' });
    }
    res.json({ success: true, message: `Vacancy ${status}`, vacancy: result.rows[0] });
  } catch (error) {
    console.error('updateVacancyStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: delete vacancy ────────────────────────────────────────────
const deleteVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM job_vacancies WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vacancy not found' });
    }
    res.json({ success: true, message: 'Vacancy deleted' });
  } catch (error) {
    console.error('deleteVacancy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Apply to a vacancy ────────────────────────────────────────────────
const applyToVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { cover_note } = req.body;
    const userId = req.user.id;

    const vacancy = await pool.query('SELECT status FROM job_vacancies WHERE id = $1', [id]);
    if (vacancy.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vacancy not found' });
    }
    if (vacancy.rows[0].status !== 'open') {
      return res.status(400).json({ success: false, message: 'This vacancy is no longer open' });
    }

    const result = await pool.query(
      `INSERT INTO job_applications (vacancy_id, user_id, cover_note) VALUES ($1, $2, $3) RETURNING *`,
      [id, userId, cover_note || null]
    );
    res.status(201).json({ success: true, message: 'Application submitted', application: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // unique_violation — already applied
      return res.status(400).json({ success: false, message: 'You have already applied to this vacancy' });
    }
    console.error('applyToVacancy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── My applications ─────────────────────────────────────────────────
const getMyApplications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ja.*, jv.title as vacancy_title, jv.department, jv.status as vacancy_status
       FROM job_applications ja
       JOIN job_vacancies jv ON ja.vacancy_id = jv.id
       WHERE ja.user_id = $1 ORDER BY ja.applied_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, applications: result.rows });
  } catch (error) {
    console.error('getMyApplications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: applicants for a vacancy ──────────────────────────────────
const getApplicants = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ja.*, u.name as applicant_name, u.role as applicant_role, u.phone as applicant_phone
       FROM job_applications ja
       JOIN users u ON ja.user_id = u.id
       WHERE ja.vacancy_id = $1 ORDER BY ja.applied_at ASC`,
      [id]
    );
    res.json({ success: true, applicants: result.rows });
  } catch (error) {
    console.error('getApplicants error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: update applicant status ───────────────────────────────────
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['submitted', 'reviewing', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const result = await pool.query(
      `UPDATE job_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, message: 'Application updated', application: result.rows[0] });
  } catch (error) {
    console.error('updateApplicationStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyCareerProfile,
  getVacancies,
  createVacancy,
  updateVacancyStatus,
  deleteVacancy,
  applyToVacancy,
  getMyApplications,
  getApplicants,
  updateApplicationStatus,
};
