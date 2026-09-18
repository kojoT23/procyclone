const express = require('express');
const router = express.Router();
const {
  getCustomers, getCustomer, createCustomer, updateCustomer,
  deleteCustomer, getCustomerProfile, updateCustomerNotes
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { can } = require('../config/roles');
const audit = require('../middleware/auditLog');

router.use(protect);

router.get('/', can('manage_customers'), getCustomers);
router.get('/:id/profile', can('manage_customers'), getCustomerProfile);
router.get('/:id', can('manage_customers'), getCustomer);

router.post('/', can('manage_customers'),
  audit('CREATE_CUSTOMER', 'customer',
    (req, data) => data?.customer?.id,
    (req, data) => `Created customer ${data?.customer?.name || ''}`
  ),
  createCustomer
);

router.put('/:id/notes', can('manage_customers'),
  audit('UPDATE_CUSTOMER_NOTES', 'customer',
    (req) => parseInt(req.params.id),
    (req) => `Updated notes on customer #${req.params.id}`
  ),
  updateCustomerNotes
);

router.put('/:id', can('manage_customers'),
  audit('UPDATE_CUSTOMER', 'customer',
    (req) => parseInt(req.params.id),
    (req) => `Updated customer #${req.params.id}`
  ),
  updateCustomer
);

router.delete('/:id', can('delete_records'),
  audit('DELETE_CUSTOMER', 'customer',
    (req) => parseInt(req.params.id),
    (req, data) => data?.message || `Deleted customer #${req.params.id}`
  ),
  deleteCustomer
);

module.exports = router;
