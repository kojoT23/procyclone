const express = require('express');
const router = express.Router();
const { getRBAC, updatePermission, resetRole } = require('../controllers/rbacController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('super_admin'));

router.get('/', getRBAC);
router.put('/', updatePermission);
router.post('/reset/:role', resetRole);

module.exports = router;
