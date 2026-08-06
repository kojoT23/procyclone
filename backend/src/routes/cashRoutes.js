const express = require('express');
const router = express.Router();
const {
  getCashLogs,
  createCashLog,
  verifyCashLog,
  disputeCashLog,
  resolveCashLog,
  getDailyReport,
  getRiderReconciliation,
} = require('../controllers/cashController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

router.get('/', getCashLogs);
router.post('/', createCashLog);

router.put('/:id/verify', authorize('super_admin','admin','manager','cashier','customer_support'),
  audit('VERIFY_CASH_LOG', 'cash_log',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Verified cash log #${req.params.id}`
  ),
  verifyCashLog
);

// Note: this route was previously defined twice, back-to-back, in this file.
// Deduplicated — the duplicate had no effect other than registering the
// same handler chain redundantly.
router.put('/:id/dispute', authorize('super_admin','admin','manager'),
  audit('DISPUTE_CASH_LOG', 'cash_log',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Disputed cash log #${req.params.id}`
  ),
  disputeCashLog
);

router.put('/:id/resolve', authorize('super_admin','admin'),
  audit('RESOLVE_CASH_LOG', 'cash_log',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Resolved cash log #${req.params.id}`
  ),
  resolveCashLog
);

router.get('/report/daily', getDailyReport);
router.get('/reconciliation', authorize('super_admin','admin','manager'), getRiderReconciliation);

module.exports = router;
