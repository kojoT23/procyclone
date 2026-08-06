const express = require('express');
const router = express.Router();
const {
  getRiders, getRider, createRider, updateRider, deleteRider,
  assignDelivery, updateDeliveryStatus, resetAvailability,
  getRiderDeliveries, getRiderStats,
} = require('../controllers/riderController');
const { protect, adminOnly, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.get('/',    protect, getRiders);
router.get('/:id/deliveries', protect, getRiderDeliveries);
router.get('/:id/stats', protect, getRiderStats);
router.get('/:id', protect, getRider);

router.post('/',   protect, adminOnly,
  audit('CREATE_RIDER', 'rider',
    (req, data) => data.rider?.id || null,
    (req, data) => `Created rider ${data.rider?.name || ''}`
  ),
  createRider
);

router.put('/:id', protect, adminOnly,
  audit('UPDATE_RIDER', 'rider',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated rider #${req.params.id}`
  ),
  updateRider
);

router.delete('/:id', protect, adminOnly,
  audit('DELETE_RIDER', 'rider',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted rider #${req.params.id}`
  ),
  deleteRider
);

router.post('/assign', protect, authorize('super_admin', 'admin', 'manager', 'customer_support'),
  audit('ASSIGN_DELIVERY', 'delivery',
    (req, data) => data.delivery?.id || req.body.delivery_id || null,
    (req, data) => data.message || `Assigned delivery${req.body.delivery_id ? ' #' + req.body.delivery_id : ''} to rider${req.body.rider_id ? ' #' + req.body.rider_id : ''}`
  ),
  assignDelivery
);

router.put('/delivery/:id/status', protect, updateDeliveryStatus);

router.post('/reset-availability', protect, adminOnly,
  audit('RESET_RIDER_AVAILABILITY', 'rider',
    () => null,
    (req, data) => data.message || 'Reset rider availability'
  ),
  resetAvailability
);

module.exports = router;
