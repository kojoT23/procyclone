const express = require('express');
const router  = express.Router();
const {
  getSettings, updateSettings,
  getMessages, markSent, dismissMessage,
} = require('../controllers/whatsappController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/settings',           authorize('super_admin', 'admin', 'manager'), getSettings);
router.put('/settings',           authorize('super_admin', 'admin'),            updateSettings);
router.get('/messages',           getMessages);
router.patch('/messages/:id/sent',markSent);
router.delete('/messages/:id',    dismissMessage);

module.exports = router;
