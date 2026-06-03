
const express = require('express');
const router = express.Router();
const { getOrders, getOrder, createOrder, updateOrderStatus, deleteOrder, createOrderValidation, updateStatusValidation } = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/', [...createOrderValidation], validate, createOrder);
router.put('/:id/status', [...updateStatusValidation], validate, updateOrderStatus);
router.delete('/:id', authorize('super_admin', 'admin'), deleteOrder);

module.exports = router;
