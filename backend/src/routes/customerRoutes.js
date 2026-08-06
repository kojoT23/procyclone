const express = require('express');
const router = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerProfile, updateCustomerNotes } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);
router.get('/', getCustomers);
router.get('/:id/profile', getCustomerProfile);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id/notes', updateCustomerNotes);
router.put('/:id', updateCustomer);

router.delete('/:id', authorize('super_admin', 'admin', 'manager'),
  audit('DELETE_CUSTOMER', 'customer',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted customer #${req.params.id}`
  ),
  deleteCustomer
);

module.exports = router;
