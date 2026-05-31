const express = require('express');
const router = express.Router();
const { getRiders, getRider, createRider, updateRider, deleteRider, assignDelivery, updateDeliveryStatus } = require('../controllers/riderController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getRiders);
router.get('/:id', protect, getRider);
router.post('/', protect, adminOnly, createRider);
router.put('/:id', protect, adminOnly, updateRider);
router.delete('/:id', protect, adminOnly, deleteRider);
router.post('/assign', protect, adminOnly, assignDelivery);
router.put('/delivery/:id/status', protect, updateDeliveryStatus);

module.exports = router;