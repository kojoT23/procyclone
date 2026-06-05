const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getProducts, getPublicProducts, getProduct, createProduct,
  updateProduct, deleteProduct, updateStock, bulkImport, createProductValidation
} = require('../controllers/productController');

// ── PUBLIC ROUTE (no auth) ──
router.get('/public', getPublicProducts);

// ── PROTECTED ROUTES ──
router.use(protect);

router.get('/', authorize('super_admin','admin','manager','warehouse','sales','rider'), getProducts);
router.get('/:id', authorize('super_admin','admin','manager','warehouse','sales'), getProduct);
router.post('/', authorize('super_admin','admin','manager','warehouse'), createProductValidation, createProduct);
router.put('/:id', authorize('super_admin','admin','manager','warehouse'), updateProduct);
router.delete('/:id', authorize('super_admin','admin'), deleteProduct);
router.patch('/:id/stock', authorize('super_admin','admin','manager','warehouse'), updateStock);
router.post('/bulk-import', authorize('super_admin','admin','manager','warehouse'), bulkImport);

module.exports = router;