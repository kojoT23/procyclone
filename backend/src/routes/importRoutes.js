const express = require('express');
const router = express.Router();
const {
  getShipments, getShipment, createShipment, updateShipment,
  updateShipmentStatus, confirmStock, deleteShipment, getShipmentSummary, getReports,
} = require('../controllers/importController');
const { protect } = require('../middleware/auth');
const { can } = require('../config/roles');
const audit = require('../middleware/auditLog');

// Same permission gate as before (manage_expenses: super_admin, admin,
// manager, accountant) — confirm-stock stays on the same permission
// rather than also requiring manage_products, so the same people who
// manage a shipment can complete it end to end without a second
// permission grant getting in the way.
router.get('/summary', protect, can('manage_expenses'), getShipmentSummary);
router.get('/reports', protect, can('manage_expenses'), getReports);
router.get('/', protect, can('manage_expenses'), getShipments);
router.get('/:id', protect, can('manage_expenses'), getShipment);

router.post('/', protect, can('manage_expenses'),
  audit('CREATE_SHIPMENT', 'shipment',
    (req, data) => data.shipment?.id || null,
    (req, data) => `Created shipment${data.shipment?.id ? ' #' + data.shipment.id : ''}${req.body.ucr ? ' (UCR ' + req.body.ucr + ')' : ''}`
  ),
  createShipment
);

router.put('/:id', protect, can('manage_expenses'),
  audit('UPDATE_SHIPMENT', 'shipment',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated shipment #${req.params.id}`
  ),
  updateShipment
);

router.put('/:id/status', protect, can('manage_expenses'),
  audit('UPDATE_SHIPMENT_STATUS', 'shipment',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated status for shipment #${req.params.id}${req.body.status ? ' to ' + req.body.status : ''}`
  ),
  updateShipmentStatus
);

router.put('/:id/confirm-stock', protect, can('manage_expenses'),
  audit('CONFIRM_SHIPMENT_STOCK', 'shipment',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Confirmed stock receipt for shipment #${req.params.id}`
  ),
  confirmStock
);

router.delete('/:id', protect, can('delete_records'),
  audit('DELETE_SHIPMENT', 'shipment',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted shipment #${req.params.id}`
  ),
  deleteShipment
);

module.exports = router;
