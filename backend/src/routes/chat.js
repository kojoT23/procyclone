const express = require('express');
const router = express.Router();
const {
  getSettings, updateSettings, getStaff,
  getConversations, getOrCreateConversation,
  getMessages, sendMessage, getUnreadCount, searchMessages,
  editMessage, deleteMessage, reactToMessage, broadcastMessage,
} = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/settings', getSettings);
router.put('/settings', authorize('super_admin'), updateSettings);

router.get('/staff', getStaff);

router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);

router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);

router.get('/unread', getUnreadCount);
router.get('/search', searchMessages);

router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/react', reactToMessage);

router.post('/broadcast', authorize('super_admin'), broadcastMessage);

module.exports = router;
