const express = require('express');
const router = express.Router();
const { getQuickLinks, createQuickLink, deleteQuickLink } = require('../controllers/quickLinksController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getQuickLinks);
router.post('/', authorize('super_admin', 'admin', 'manager'), createQuickLink);
router.delete('/:id', authorize('super_admin', 'admin', 'manager'), deleteQuickLink);

module.exports = router;
