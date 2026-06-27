const express = require('express');
const router  = express.Router();
const {
  getSettings, saveSettings, testBot,
  linkRiderTelegram,
} = require('../controllers/telegramController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/settings',           authorize('super_admin', 'admin'), getSettings);
router.post('/settings',          authorize('super_admin', 'admin'), saveSettings);
router.post('/test',              authorize('super_admin', 'admin'), testBot);
router.patch('/riders/:id/link',  authorize('super_admin', 'admin'), linkRiderTelegram);

module.exports = router;
