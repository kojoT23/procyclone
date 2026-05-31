const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const pool = require('../config/db');
const { ROLES } = require('../config/roles');

const createUserValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('role').isIn(Object.keys(ROLES)).withMessage('Invalid role'),
  body('phone').optional(),
];

const updateUserValidation = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(Object.keys(ROLES)).withMessage('Invalid role'),
];

const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (role) { conditions.push(`role = $${i++}`); values.push(role); }
    if (search) {
      conditions.push(`(name ILIKE $${i} OR email ILIKE $${i} OR phone ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, values);
    const result = await pool.query(
      `SELECT id, name, email, role, phone, is_active, last_login, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      users: result.rows,
    });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, email, role, phone, is_active, last_login, created_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admin can create another super admin' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, phone, is_active, created_at`,
      [name, email, hashedPassword, role, phone]
    );

    res.status(201).json({
      success: true,
      message: `${ROLES[role].label} account created successfully`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone } = req.body;

    if (role && role !== 'super_admin') {
      const superAdmins = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND is_active = true"
      );
      const current = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
      if (current.rows[0]?.role === 'super_admin' && parseInt(superAdmins.rows[0].count) <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the only super admin' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        phone = COALESCE($4, phone),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, role, phone, is_active, updated_at`,
      [name, email, role, phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    const current = await pool.query('SELECT is_active, role FROM users WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (current.rows[0].role === 'super_admin') {
      const superAdmins = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND is_active = true"
      );
      if (parseInt(superAdmins.rows[0].count) <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot deactivate the only super admin' });
      }
    }

    const newStatus = !current.rows[0].is_active;
    const result = await pool.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = Object.entries(ROLES).map(([key, value]) => ({
      key,
      label: value.label,
      description: value.description,
      permissions: value.permissions,
    }));
    res.json({ success: true, roles });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  getRoles,
  createUserValidation,
  updateUserValidation,
};