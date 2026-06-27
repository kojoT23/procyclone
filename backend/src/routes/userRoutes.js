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
router.put('/:id', authorize('super_admin', 'admin'), [...updateUserValidation], validate, updateUser);
router.patch('/:id/toggle', authorize('super_admin'), toggleUserStatus);
router.delete('/:id',       authorize('super_admin'), deleteUser);

module.exports = router;
