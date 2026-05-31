const express = require('express');
const router = express.Router();
const { getOrders, getOrder, createOrder, updateOrderStatus, createOrderValidation, updateStatusValidation } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/', [...createOrderValidation], validate, createOrder);
router.put('/:id/status', [...updateStatusValidation], validate, updateOrderStatus);

module.exports = router;
