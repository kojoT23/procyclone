const express = require('express');
const router  = express.Router();
const {
  getOutstanding, declareSettlement, getSettlements, approveSettlement,
  getFinancialOverview,
  declareSettlementValidation, approveSettlementValidation,
} = require('../controllers/settlementController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

// Office-only financial snapshot — rider cash, expenses, imports, revenue.
// Read-only, so no audit() needed here (matches getOutstanding/getSettlements
// below, which also don't log). Kept broader than the approve step below —
// viewing a dashboard is lower-stakes than actually approving cash.
router.get('/overview', authorize('admin', 'super_admin', 'manager', 'accountant'), getFinancialOverview);

// Any authenticated user (rider checking their own, or office) can read
router.get('/outstanding/:riderId', getOutstanding);
router.get('/', getSettlements);

// Any authenticated rider can declare their own settlement
router.post('/',
  [...declareSettlementValidation], validate,
  audit('DECLARE_SETTLEMENT', 'settlement',
    (req, data) => data.settlement?.id,
    (req, data) => `Declared settlement of GH₵${data.settlement?.declared_amount} (${req.body.order_ids?.length || 0} orders)`
  ),
  declareSettlement
);

// Only admin/super_admin approve — this is the human counter-check step
router.put('/:id/approve',
  authorize('admin', 'super_admin'),
  [...approveSettlementValidation], validate,
  audit('APPROVE_SETTLEMENT', 'settlement',
    (req) => parseInt(req.params.id),
    (req, data) => data.message
  ),
  approveSettlement
);

module.exports = router;
