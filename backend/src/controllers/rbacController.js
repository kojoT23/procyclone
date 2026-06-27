const pool = require('../config/db');
const { ROLES, ALL_PERMISSIONS } = require('../config/roles');

// GET /api/rbac — get all roles, permissions, and any DB overrides
const getRBAC = async (req, res) => {
  try {
    const overrides = await pool.query('SELECT role, permission, granted FROM role_permissions');
    const overrideMap = {};
    overrides.rows.forEach(r => {
      if (!overrideMap[r.role]) overrideMap[r.role] = {};
      overrideMap[r.role][r.permission] = r.granted;
    });

    const roles = Object.entries(ROLES).map(([key, role]) => ({
      key,
      label: role.label,
      description: role.description,
      permissions: ALL_PERMISSIONS.map(p => ({
        key: p.key,
        granted: overrideMap[key]?.[p.key] !== undefined
          ? overrideMap[key][p.key]
          : role.permissions.includes(p.key),
        overridden: overrideMap[key]?.[p.key] !== undefined,
      })),
    }));

    res.json({ success: true, roles, permissions: ALL_PERMISSIONS });
  } catch (error) {
    console.error('getRBAC error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/rbac — toggle a permission for a role
const updatePermission = async (req, res) => {
  try {
    const { role, permission, granted } = req.body;

    if (!ROLES[role]) return res.status(400).json({ success: false, message: 'Invalid role' });
    if (!ALL_PERMISSIONS.find(p => p.key === permission)) {
      return res.status(400).json({ success: false, message: 'Invalid permission' });
    }
    if (role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin permissions' });
    }

    // Check if it matches the default — if so, delete the override
    const isDefault = ROLES[role].permissions.includes(permission);
    if (granted === isDefault) {
      await pool.query('DELETE FROM role_permissions WHERE role = $1 AND permission = $2', [role, permission]);
    } else {
      await pool.query(
        `INSERT INTO role_permissions (role, permission, granted, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (role, permission) DO UPDATE
         SET granted = $3, updated_by = $4, updated_at = NOW()`,
        [role, permission, granted, req.user.id]
      );
    }

    res.json({ success: true, message: 'Permission updated' });
  } catch (error) {
    console.error('updatePermission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/rbac/reset/:role — reset a role to defaults
const resetRole = async (req, res) => {
  try {
    const { role } = req.params;
    if (!ROLES[role]) return res.status(400).json({ success: false, message: 'Invalid role' });
    if (role === 'super_admin') return res.status(403).json({ success: false, message: 'Cannot reset Super Admin' });

    await pool.query('DELETE FROM role_permissions WHERE role = $1', [role]);
    res.json({ success: true, message: `${ROLES[role].label} reset to defaults` });
  } catch (error) {
    console.error('resetRole error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getRBAC, updatePermission, resetRole };
