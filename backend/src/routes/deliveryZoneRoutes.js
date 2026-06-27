const express = require('express');
const router  = express.Router();
const {
  getZones, createZone, updateZone, deleteZone, zoneValidation,
} = require('../controllers/deliveryZoneController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

// Any authenticated user can read zones (needed when creating an order)
router.get('/', getZones);

// Only super_admin can manage zones
router.post('/',
  authorize('super_admin'),
  [...zoneValidation], validate,
  audit('CREATE_DELIVERY_ZONE', 'delivery_zone',
    (req, data) => data.zone?.id,
    (req, data) => `Created delivery zone "${data.zone?.name}" — fee GH₵${data.zone?.fee}`
  ),
  createZone
);

router.put('/:id',
  authorize('super_admin'),
  [...zoneValidation], validate,
  audit('UPDATE_DELIVERY_ZONE', 'delivery_zone',
    (req) => parseInt(req.params.id),
    (req, data) => `Updated delivery zone "${data.zone?.name}"`
  ),
  updateZone
);

router.delete('/:id',
  authorize('super_admin'),
  audit('DEACTIVATE_DELIVERY_ZONE', 'delivery_zone',
    (req) => parseInt(req.params.id),
    (req, data) => data.message
  ),
  deleteZone
);

module.exports = router;
