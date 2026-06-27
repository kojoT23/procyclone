const express = require('express');
const router  = express.Router();
const {
  getPayments, createPayment, verifyPayment, failPayment, getPaymentSummary,
} = require('../controllers/paymentController');
const { protect, adminOnly } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

router.get('/',          getPayments);
router.get('/summary',   getPaymentSummary);
router.post('/',         adminOnly, createPayment);

router.put('/:id/verify',
  audit('VERIFY_PAYMENT', 'payment',
    (req) => parseInt(req.params.id),
    (req, data) => `Verified payment — Ref: ${req.body.reference || 'N/A'}`
  ),
  verifyPayment
);

router.put('/:id/fail',
  audit('FAIL_PAYMENT', 'payment',
    (req) => parseInt(req.params.id),
    () => 'Marked payment as failed'
  ),
  failPayment
);

module.exports = router;
