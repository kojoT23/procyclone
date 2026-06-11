const express = require('express');
const router  = express.Router();
const {
  getUsers, getUser, createUser, updateUser,
  toggleUserStatus, deleteUser, getRoles,
  createUserValidation, updateUserValidation,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/',          authorize('super_admin', 'admin'), getUsers);
router.get('/roles',     authorize('super_admin', 'admin'), getRoles);
router.get('/:id',       authorize('super_admin', 'admin'), getUser);
router.post('/',         authorize('super_admin', 'admin'), [...createUserValidation], validate, createUser);
router.put('/:id',       authorize('super_admin', 'admin'), [...updateUserValidation], validate, updateUser);
router.patch('/:id/toggle', authorize('super_admin'), toggleUserStatus);
router.delete('/:id',    authorize('super_admin'), deleteUser); // ← super_admin only

module.exports = router;
