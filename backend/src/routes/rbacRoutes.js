const express = require('express');
const router = express.Router();
const { getRBAC, updatePermission, resetRole } = require('../controllers/rbacController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);
router.use(authorize('super_admin'));

router.get('/', getRBAC);

router.put('/',
  audit('UPDATE_PERMISSION', 'permission',
    () => null,
    (req, data) => data.message || `Updated permission '${req.body.permission || ''}' for role '${req.body.role || ''}' to ${req.body.value}`
  ),
  updatePermission
);

router.post('/reset/:role',
  audit('RESET_ROLE_PERMISSIONS', 'permission',
    () => null,
    (req, data) => data.message || `Reset permissions for role '${req.params.role}' to defaults`
  ),
  resetRole
);

module.exports = router;
