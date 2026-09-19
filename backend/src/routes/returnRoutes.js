const express = require('express');
const router = express.Router();
const {
  getReturns, submitEnquiry, approveDisposal, confirmReturnRefund,
} = require('../controllers/returnController');
const { protect, authorize } = require('../middleware/auth');
const { can } = require('../config/roles');
const audit = require('../middleware/auditLog');

router.use(protect);

router.get('/', getReturns);

router.put('/:id/enquiry',
  audit('SUBMIT_RETURN_ENQUIRY', 'order_return',
    (req) => parseInt(req.params.id),
    (req) => `Completed return enquiry — condition: ${req.body.condition}`
  ),
  submitEnquiry
);

// Only admin/manager can resolve a damaged item — deliberately separate
// from whoever completed the enquiry, so no single person can both flag
// something as damaged and approve its disposal alone.
router.put('/:id/disposal', authorize('super_admin', 'admin', 'manager'),
  audit('APPROVE_RETURN_DISPOSAL', 'order_return',
    (req) => parseInt(req.params.id),
    (req) => `Disposal resolved: ${req.body.resolution}`
  ),
  approveDisposal
);

router.put('/:id/refund', can('manage_orders'),
  audit('CONFIRM_RETURN_REFUND', 'order_return',
    (req) => parseInt(req.params.id),
    () => 'Confirmed refund sent for a return'
  ),
  confirmReturnRefund
);

module.exports = router;
