const express = require('express');
const router  = express.Router();
const { getNotifications } = require('../controllers/notificationsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getNotifications);

module.exports = router;
