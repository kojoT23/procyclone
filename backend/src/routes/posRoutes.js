const express = require('express');
const router = express.Router();
const { createSale, getSales, getSummary, selfCheckout, confirmSale } = require('../controllers/posController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

// Public — no login. A customer in the store builds their own cart and
// gets a ticket number, no staff account needed for this step.
router.post('/self-checkout', selfCheckout);

// Everything else is staff-only — same roles trusted with orders/
// payments generally.
router.use(protect);

router.get('/sales', authorize('super_admin', 'admin', 'manager', 'cashier'), getSales);
router.get('/summary', authorize('super_admin', 'admin', 'manager', 'cashier'), getSummary);

router.post('/sales', authorize('super_admin', 'admin', 'manager', 'cashier'),
  audit('CREATE_POS_SALE', 'pos_sale',
    (req, data) => data?.sale?.id,
    (req, data) => `POS sale ${data?.sale?.sale_number} — GH₵${data?.sale?.total_amount}`
  ),
  createSale
);

router.put('/sales/:id/confirm', authorize('super_admin', 'admin', 'manager', 'cashier'),
  audit('CONFIRM_POS_SALE', 'pos_sale',
    (req) => parseInt(req.params.id),
    (req, data) => `Confirmed self-checkout ticket ${data?.sale?.sale_number} — ${req.body.payment_method}`
  ),
  confirmSale
);

module.exports = router;
