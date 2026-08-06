const express = require('express');
const router = express.Router();
const {
  createRestockRequest,
  getRestockRequests,
  updateRestockRequestStatus,
} = require('../controllers/restockController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

router.post('/', createRestockRequest); // any authenticated user can flag low stock
router.get('/', getRestockRequests); // scoped to own requests unless privileged (see controller)

router.put('/:id/status', authorize('super_admin', 'admin', 'manager', 'warehouse'),
  audit('UPDATE_RESTOCK_STATUS', 'restock_request',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated restock request #${req.params.id} to ${req.body.status || 'new status'}`
  ),
  updateRestockRequestStatus
);

module.exports = router;
