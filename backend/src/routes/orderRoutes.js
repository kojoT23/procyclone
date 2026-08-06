const express = require('express');
const router  = express.Router();
const {
  getOrders, getOrder, createOrder, createBulkOrders, updateOrderStatus, cancelOrder, getDeliveryProof,
  deleteOrder, createOrderValidation, createBulkOrdersValidation, updateStatusValidation,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

router.get('/',    getOrders);
router.get('/:id', getOrder);
router.get('/:id/proof', getDeliveryProof);

router.post('/',
  [...createOrderValidation], validate,
  audit('CREATE_ORDER', 'order',
    (req, data) => data.order?.id,
    (req, data) => `Created order ${data.order?.order_number} — GH₵ ${data.order?.total_amount}`
  ),
  createOrder
);

router.post('/bulk',
  [...createBulkOrdersValidation], validate,
  audit('CREATE_BULK_ORDERS', 'order',
    (req, data) => null,
    (req, data) => `Mass Order: created ${data.created_count} order(s)${data.failed_count ? `, ${data.failed_count} failed` : ''}`
  ),
  createBulkOrders
);

router.put('/:id/status',
  [...updateStatusValidation], validate,
  audit('UPDATE_ORDER_STATUS', 'order',
    (req) => parseInt(req.params.id),
    (req) => `Changed order status to ${req.body.status}`
  ),
  updateOrderStatus
);

router.put('/:id/cancel',
  authorize('super_admin', 'admin', 'manager', 'customer_support'),
  audit('CANCEL_ORDER', 'order',
    (req) => parseInt(req.params.id),
    (req) => `Cancelled order${req.body.reason ? `: ${req.body.reason}` : ''}`
  ),
  cancelOrder
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
