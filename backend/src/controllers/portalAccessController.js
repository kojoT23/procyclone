const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════
   staff_portal_access table — created on first use if missing.
   Mirrors the simplicity of riders.user_id: a row existing for a
   user_id means that staff member can use the mobile portal.
   No row = no access. This is a navigation gate only, NOT a data
   permission — actual data access is still controlled entirely by
   the existing role-based `authorize()` middleware on each API
   route, same as it always has been.
═══════════════════════════════════════════════════════════════ */
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_portal_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      granted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/portal-access
   Lists every staff member (admin/manager/super_admin) with
   whether they currently have portal access.
   Accessible by: super_admin ONLY
═══════════════════════════════════════════════════════════════ */
const getPortalAccessList = async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.is_active,
        spa.created_at AS granted_at,
        (spa.id IS NOT NULL) AS portal_access
      FROM users u
      LEFT JOIN staff_portal_access spa ON spa.user_id = u.id
      WHERE u.role IN ('super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse')
      ORDER BY u.role, u.name
    `);
    res.json({ success: true, staff: result.rows });
  } catch (error) {
    console.error('getPortalAccessList error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/portal-access/:userId
   Grants portal access to a staff member.
   Accessible by: super_admin ONLY
═══════════════════════════════════════════════════════════════ */
const grantPortalAccess = async (req, res) => {
  try {
    await ensureTable();
    const { userId } = req.params;

    const target = await pool.query(
      "SELECT id, role FROM users WHERE id = $1 AND is_active = true",
      [userId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!['super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse'].includes(target.rows[0].role)) {
      return res.status(400).json({
        success: false,
        message: 'Portal access only applies to staff roles (super_admin, admin, manager, cashier, dispatcher, warehouse)',
      });
    }

    await pool.query(
      `INSERT INTO staff_portal_access (user_id, granted_by)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, req.user.id]
    );

    res.json({ success: true, message: 'Portal access granted' });
  } catch (error) {
    console.error('grantPortalAccess error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/settings/portal-access/:userId
   Revokes portal access from a staff member.
   Accessible by: super_admin ONLY
═══════════════════════════════════════════════════════════════ */
const revokePortalAccess = async (req, res) => {
  try {
    await ensureTable();
    const { userId } = req.params;
    await pool.query('DELETE FROM staff_portal_access WHERE user_id = $1', [userId]);
    res.json({ success: true, message: 'Portal access revoked' });
  } catch (error) {
    console.error('revokePortalAccess error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPortalAccessList,
  grantPortalAccess,
  revokePortalAccess,
};
