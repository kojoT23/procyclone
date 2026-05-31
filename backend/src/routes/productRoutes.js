const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock } = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getProducts);
router.get('/:id', protect, getProduct);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);
router.patch('/:id/stock', protect, adminOnly, updateStock);

module.exports = router;
