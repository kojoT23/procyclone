const express = require('express');
const router = express.Router();
const {
  getStockMovements,
  adjustStock,
  getSuppliers,
  createSupplier,
  updateSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Stock movements
router.get('/movements', getStockMovements);
router.post('/movements/adjust', authorize('super_admin','admin','manager','warehouse'), adjustStock);

// Suppliers
router.get('/suppliers', getSuppliers);
router.post('/suppliers', authorize('super_admin','admin','manager'), createSupplier);
router.put('/suppliers/:id', authorize('super_admin','admin','manager'), updateSupplier);

// Purchase orders
router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', authorize('super_admin','admin','manager'), createPurchaseOrder);
router.post('/purchase-orders/:id/receive', authorize('super_admin','admin','manager','warehouse'), receivePurchaseOrder);

module.exports = router;
