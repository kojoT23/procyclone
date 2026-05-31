const express = require('express');
const router = express.Router();
const { getCashLogs, createCashLog, verifyCashLog, getDailyReport } = require('../controllers/cashController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getCashLogs);
router.post('/', protect, createCashLog);
router.put('/:id/verify', protect, adminOnly, verifyCashLog);
router.get('/report/daily', protect, getDailyReport);

module.exports = router;