const express = require('express');
const router = express.Router();
const { createSale, getSales, getSummary } = require('../controllers/posController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

// Same roles trusted with orders/payments generally — a cashier ringing
// up a sale needs to be someone accountable for money, not every role.
router.get('/sales', authorize('super_admin', 'admin', 'manager', 'cashier'), getSales);
router.get('/summary', authorize('super_admin', 'admin', 'manager', 'cashier'), getSummary);

router.post('/sales', authorize('super_admin', 'admin', 'manager', 'cashier'),
  audit('CREATE_POS_SALE', 'pos_sale',
    (req, data) => data?.sale?.id,
    (req, data) => `POS sale ${data?.sale?.sale_number} — GH₵${data?.sale?.total_amount}`
  ),
  createSale
);

module.exports = router;
