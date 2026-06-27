const express = require('express');
const router  = express.Router();
const {
  getOrders, getOrder, createOrder, updateOrderStatus,
  deleteOrder, createOrderValidation, updateStatusValidation,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

router.get('/',    getOrders);
router.get('/:id', getOrder);

router.post('/',
  [...createOrderValidation], validate,
  audit('CREATE_ORDER', 'order',
    (req, data) => data.order?.id,
    (req, data) => `Created order ${data.order?.order_number} — GH₵ ${data.order?.total_amount}`
  ),
  createOrder
);

router.put('/:id/status',
  [...updateStatusValidation], validate,
  audit('UPDATE_ORDER_STATUS', 'order',
    (req) => parseInt(req.params.id),
    (req) => `Changed order status to ${req.body.status}`
  ),
  updateOrderStatus
);

router.delete('/:id',
  authorize('super_admin', 'admin'),
  audit('DELETE_ORDER', 'order',
    (req) => parseInt(req.params.id),
    (req, data) => `Deleted order ${data.message}`
  ),
  deleteOrder
);

module.exports = router;
