const express = require('express');
const router = express.Router();
const {
  getPayments,
  createPayment,
  verifyPayment,
  failPayment,
  getPaymentSummary,
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getPayments);
router.post('/', createPayment);
router.put('/:id/verify', authorize('super_admin','admin','manager','cashier'), verifyPayment);
router.put('/:id/fail', authorize('super_admin','admin','manager'), failPayment);
router.get('/summary', getPaymentSummary);

module.exports = router;
