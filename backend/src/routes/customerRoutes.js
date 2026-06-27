const express = require('express');
const router = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerProfile, updateCustomerNotes } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getCustomers);
router.get('/:id/profile', getCustomerProfile);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id/notes', updateCustomerNotes);
router.put('/:id', updateCustomer);
router.delete('/:id', authorize('super_admin', 'admin', 'manager'), deleteCustomer);

module.exports = router;
