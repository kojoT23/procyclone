const express = require('express');
const router = express.Router();
const {
  getCashLogs,
  createCashLog,
  verifyCashLog,
  disputeCashLog,
  getDailyReport,
  getRiderReconciliation,
} = require('../controllers/cashController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getCashLogs);
router.post('/', createCashLog);
router.put('/:id/verify', authorize('super_admin','admin','manager','cashier'), verifyCashLog);
router.put('/:id/dispute', authorize('super_admin','admin','manager'), disputeCashLog);
router.get('/report/daily', getDailyReport);
router.get('/reconciliation', authorize('super_admin','admin','manager'), getRiderReconciliation);

module.exports = router;
