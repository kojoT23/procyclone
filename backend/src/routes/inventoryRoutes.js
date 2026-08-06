const express = require('express');
const router = express.Router();
const {
  getStockMovements,
  adjustStock,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

// Stock movements
router.get('/movements', getStockMovements);
router.post('/movements/adjust', authorize('super_admin','admin','manager','warehouse'),
  audit('ADJUST_STOCK', 'product',
    (req, data) => req.body.product_id || data.movement?.product_id || null,
    (req, data) => data.message || `Adjusted stock for product #${req.body.product_id}${req.body.quantity !== undefined ? ' by ' + req.body.quantity : ''}`
  ),
  adjustStock
);

// Suppliers
router.get('/suppliers', getSuppliers);

router.post('/suppliers', authorize('super_admin','admin','manager'),
  audit('CREATE_SUPPLIER', 'supplier',
    (req, data) => data.supplier?.id || null,
    (req, data) => `Created supplier ${data.supplier?.name || ''}`
  ),
  createSupplier
);

router.put('/suppliers/:id', authorize('super_admin','admin','manager'),
  audit('UPDATE_SUPPLIER', 'supplier',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated supplier #${req.params.id}`
  ),
  updateSupplier
);

router.delete('/suppliers/:id', authorize('super_admin','admin','manager'),
  audit('DELETE_SUPPLIER', 'supplier',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted supplier #${req.params.id}`
  ),
  deleteSupplier
);

// Purchase orders
router.get('/purchase-orders', getPurchaseOrders);
router.get('/purchase-orders/:id', getPurchaseOrder);

router.post('/purchase-orders', authorize('super_admin','admin','manager'),
  audit('CREATE_PURCHASE_ORDER', 'purchase_order',
    (req, data) => data.purchaseOrder?.id || data.po?.id || null,
    (req, data) => `Created purchase order #${data.purchaseOrder?.id || data.po?.id || ''} for supplier #${req.body.supplier_id || ''}`
  ),
  createPurchaseOrder
);

router.put('/purchase-orders/:id', authorize('super_admin','admin','manager'),
  audit('UPDATE_PURCHASE_ORDER', 'purchase_order',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated purchase order #${req.params.id}`
  ),
  updatePurchaseOrder
);

router.put('/purchase-orders/:id/cancel', authorize('super_admin','admin','manager'),
  audit('CANCEL_PURCHASE_ORDER', 'purchase_order',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Cancelled purchase order #${req.params.id}`
  ),
  cancelPurchaseOrder
);

router.post('/purchase-orders/:id/receive', authorize('super_admin','admin','manager','warehouse'),
  audit('RECEIVE_PURCHASE_ORDER', 'purchase_order',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Received purchase order #${req.params.id}`
  ),
  receivePurchaseOrder
);

module.exports = router;
