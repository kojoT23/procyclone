const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock, bulkImport, createProductValidation } = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
// Public route — no auth required for storefront
router.get('/public', getProducts);
router.use(protect);

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('super_admin','admin','manager','warehouse'), [...createProductValidation], validate, createProduct);
router.put('/:id', authorize('super_admin','admin','manager','warehouse'), updateProduct);
router.delete('/:id', authorize('super_admin','admin'), deleteProduct);
router.patch('/:id/stock', authorize('super_admin','admin','manager','warehouse'), updateStock);
router.post('/bulk-import', authorize('super_admin','admin','manager','warehouse'), bulkImport);

module.exports = router;
