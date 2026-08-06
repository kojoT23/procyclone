const express = require('express');
const router  = express.Router();
const {
  getUsers, getUser, createUser, updateUser,
  toggleUserStatus, deleteUser, getRoles,
  getProfile, updateProfile, changePassword, getAuditLog,
  createUserValidation, updateUserValidation,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit = require('../middleware/auditLog');

router.use(protect);

/* ── Own profile — any logged-in user ── */
router.get('/profile',          getProfile);
router.put('/profile',          updateProfile);
router.post('/change-password', changePassword);

/* ── Audit log — super_admin only ── */
router.get('/audit-log', authorize('super_admin'), getAuditLog);

/* ── Staff management — admin + super_admin ── */
router.get('/',    authorize('super_admin', 'admin'), getUsers);
router.get('/roles', authorize('super_admin', 'admin'), getRoles);
router.get('/:id', authorize('super_admin', 'admin'), getUser);
router.post('/',   authorize('super_admin', 'admin'), [...createUserValidation], validate, createUser);

// Wrapped in audit() so role/detail changes actually get recorded —
// previously this route made real changes with zero audit trail.
router.put('/:id', authorize('super_admin', 'admin'), [...updateUserValidation], validate,
  audit('UPDATE_USER', 'user',
    (req) => parseInt(req.params.id),
    (req, data) => `Updated ${data.user?.name || 'user #' + req.params.id}${req.body.role ? ' — role set to ' + req.body.role : ''}`
  ),
  updateUser
);

// Wrapped so activate/deactivate is recorded — this is exactly the
// kind of action an auditor needs to see (who disabled/enabled an
// account, and when).
router.patch('/:id/toggle', authorize('super_admin'),
  audit('TOGGLE_USER_STATUS', 'user',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Toggled status for user #${req.params.id}`
  ),
  toggleUserStatus
);

router.delete('/:id', authorize('super_admin'),
  audit('DELETE_USER', 'user',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted user #${req.params.id}`
  ),
  deleteUser
);

module.exports = router;
