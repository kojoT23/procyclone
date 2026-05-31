const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { Resend } = require('resend');
const pool = require('../config/db');
const env = require('../config/env');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Validation ─────────────────────────────────────────────────
const requestResetValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

// ── Request password reset ─────────────────────────────────────
const requestReset = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success even if email not found — security best practice
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent',
      });
    }

    const user = result.rows[0];

    // Invalidate any existing tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: 'ProCyclone <onboarding@resend.dev>',
      to: user.email,
      subject: 'ProCyclone — Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1a1a18;">Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>Someone requested a password reset for your ProCyclone account.</p>
          <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" 
             style="display: inline-block; background: #D85A30; color: white; 
                    padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 13px;">If you didn't request this, ignore this email. Your password will not change.</p>
          <p style="color: #666; font-size: 13px;">Link: ${resetUrl}</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent',
    });
  } catch (error) {
    console.error('requestReset error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Verify token ───────────────────────────────────────────────
const verifyToken = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT prt.*, u.email, u.name FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    res.json({ success: true, message: 'Token is valid', email: result.rows[0].email });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Reset password ─────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await pool.query(
      `SELECT prt.*, u.id as user_id FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and mark token as used in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, result.rows[0].user_id]
      );
      await client.query(
        'UPDATE password_reset_tokens SET used = true WHERE token = $1',
        [token]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  requestReset,
  verifyToken,
  resetPassword,
  requestResetValidation,
  resetPasswordValidation,
};