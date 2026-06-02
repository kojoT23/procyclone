const express = require('express');
const router = express.Router();
const { getRevenueReport, getProductReport, getRiderReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('super_admin', 'admin', 'manager'));

router.get('/revenue', getRevenueReport);
router.get('/products', getProductReport);
router.get('/riders', getRiderReport);

module.exports = router;
