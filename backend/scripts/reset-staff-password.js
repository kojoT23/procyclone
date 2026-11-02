/* ═══════════════════════════════════════════════════════════════
   Owner-run password reset — no email needed.

   Usage (from the backend folder):
     node scripts/reset-staff-password.js <email> <new-password>

   Sets the new password and signs that person out everywhere (their
   current sessions stop working within 15 minutes). Same password rule
   as the app: at least 8 characters with at least one number. Tell the
   staff member to change it to their own after their first login.
═══════════════════════════════════════════════════════════════ */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

(async () => {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-staff-password.js <email> <new-password>');
    process.exit(1);
  }
  if (newPassword.length < 8 || !/\d/.test(newPassword)) {
    console.log('Password must be at least 8 characters and contain at least one number.');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE users
          SET password = $1, token_version = token_version + 1, updated_at = NOW()
        WHERE LOWER(email) = LOWER($2)
        RETURNING name, role, is_active`,
      [hash, email.trim()]
    );
    if (result.rowCount === 0) {
      console.log(`No account found for ${email}`);
      process.exit(1);
    }
    const u = result.rows[0];
    console.log(`Password updated for ${u.name} (${u.role}).${u.is_active ? '' : ' NOTE: this account is deactivated and still cannot log in.'}`);
    process.exit(0);
  } catch (err) {
    console.log('Could not update password:', err.message);
    process.exit(1);
  }
})();
