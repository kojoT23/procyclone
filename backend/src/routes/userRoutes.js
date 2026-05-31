const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  getRoles,
  createUserValidation,
  updateUserValidation,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

// Only super_admin and admin can manage users
router.get('/', authorize('super_admin', 'admin'), getUsers);
router.get('/roles', authorize('super_admin', 'admin'), getRoles);
router.get('/:id', authorize('super_admin', 'admin'), getUser);
router.post('/', authorize('super_admin', 'admin'), [...createUserValidation], validate, createUser);
router.put('/:id', authorize('super_admin', 'admin'), [...updateUserValidation], validate, updateUser);
router.patch('/:id/toggle', authorize('super_admin'), toggleUserStatus);

module.exports = router;
