const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../config/db');
const env = require('../config/env');

const generateAccessToken = (id) =>
  jwt.sign({ id }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

// Logs every login attempt — success or failure — so Login Anomalies
// has real data to work from. Never throws: a failure to write this
// log must never block or break the actual login response.
const logLoginAttempt = async ({ userId = null, email, success, failureReason = null, req }) => {
  try {
    await pool.query(
      `INSERT INTO login_attempts (user_id, email_attempted, success, failure_reason, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email || null, success, failureReason, req.ip || req.connection?.remoteAddress || null]
    );
  } catch (err) {
    console.error('logLoginAttempt error:', err.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      await logLoginAttempt({ email, success: false, failureReason: 'invalid_email', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logLoginAttempt({ userId: user.id, email, success: false, failureReason: 'invalid_password', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.is_active) {
      await logLoginAttempt({ userId: user.id, email, success: false, failureReason: 'account_inactive', req });
      const message = user.role === 'customer_support'
        ? 'Your account is awaiting approval from a Super Admin. Please check back soon.'
        : 'This account has been deactivated. Contact a Super Admin.';
      return res.status(403).json({ success: false, code: 'ACCOUNT_INACTIVE', message });
    }

    await logLoginAttempt({ userId: user.id, email, success: true, req });
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    let portalAccess = false;
    if (user.role === 'rider') {
      portalAccess = true;
    } else if (['super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse'].includes(user.role)) {
      try {
        const access = await pool.query(
          'SELECT 1 FROM staff_portal_access WHERE user_id = $1',
          [user.id]
        );
        portalAccess = access.rows.length > 0;
      } catch (accessErr) {
        console.error('portal_access lookup error:', accessErr);
        portalAccess = false;
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone,
        portal_access: portalAccess,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }
    const decoded = jwt.verify(token, env.jwt.refreshSecret);
    const result = await pool.query(
      'SELECT id, name, email, role, phone FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    const accessToken = generateAccessToken(decoded.id);
    res.json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

const getMe = async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, req.user.id]
    );
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  login,
  refreshToken,
  getMe,
  changePassword,
  loginValidation,
  changePasswordValidation
};
