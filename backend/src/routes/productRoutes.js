const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getProducts, getPublicProducts, getProduct, getProductByBarcode, getCategories, createProduct,
  updateProduct, deleteProduct, updateStock, bulkImport, createProductValidation
} = require('../controllers/productController');
const { getTrendingSuggestions } = require('../controllers/aiController');
const audit = require('../middleware/auditLog');

// ── PUBLIC ROUTE (no auth) ──
router.get('/public', getPublicProducts);

// ── PROTECTED ROUTES ──
router.use(protect);

router.get('/', authorize('super_admin','admin','manager','warehouse','sales','rider','customer_support'), getProducts);
router.get('/categories', authorize('super_admin','admin','manager','warehouse','sales','rider','customer_support'), getCategories);
router.get('/ai/trending-suggestions', authorize('super_admin','admin','manager','warehouse'), getTrendingSuggestions);
router.get('/barcode/:code', authorize('super_admin','admin','manager','warehouse','sales','customer_support'), getProductByBarcode);
router.get('/:id', authorize('super_admin','admin','manager','warehouse','sales','customer_support'), getProduct);

router.post('/', authorize('super_admin','admin','manager','warehouse'), createProductValidation,
  audit('CREATE_PRODUCT', 'product',
    (req, data) => data.product?.id || null,
    (req, data) => `Created product ${data.product?.name || ''} (#${data.product?.id || 'unknown'})`
  ),
  createProduct
);

router.put('/:id', authorize('super_admin','admin','manager','warehouse'),
  audit('UPDATE_PRODUCT', 'product',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated product #${req.params.id}`
  ),
  updateProduct
);

router.delete('/:id', authorize('super_admin','admin'),
  audit('DELETE_PRODUCT', 'product',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted product #${req.params.id}`
  ),
  deleteProduct
);

router.patch('/:id/stock', authorize('super_admin','admin','manager','warehouse'),
  audit('UPDATE_STOCK', 'product',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Adjusted stock for product #${req.params.id}${req.body.quantity !== undefined ? ' to ' + req.body.quantity : ''}`
  ),
  updateStock
);

router.post('/bulk-import', authorize('super_admin','admin','manager','warehouse'),
  audit('BULK_IMPORT_PRODUCTS', 'product',
    () => null,
    (req, data) => data.message || `Bulk imported ${data.imported ?? data.count ?? 'products'}`
  ),
  bulkImport
);

module.exports = router;
