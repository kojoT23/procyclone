const express = require('express');
const router = express.Router();
const { createRequest, getRequests, acknowledgeRequest, resolveRequest } = require('../controllers/assistanceController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

// Public — no login. A customer at a Store Mode kiosk calling for help.
router.post('/', createRequest);

// Staff-only from here — same roles trusted with POS generally.
router.use(protect);

router.get('/', authorize('super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse', 'customer_support'), getRequests);

router.put('/:id/acknowledge', authorize('super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse', 'customer_support'),
  audit('ACKNOWLEDGE_ASSISTANCE_REQUEST', 'assistance_request',
    (req) => parseInt(req.params.id),
    (req, data) => `Acknowledged assistance request #${req.params.id}`
  ),
  acknowledgeRequest
);

router.put('/:id/resolve', authorize('super_admin', 'admin', 'manager', 'cashier', 'dispatcher', 'warehouse', 'customer_support'),
  audit('RESOLVE_ASSISTANCE_REQUEST', 'assistance_request',
    (req) => parseInt(req.params.id),
    (req, data) => `Resolved assistance request #${req.params.id}`
  ),
  resolveRequest
);

module.exports = router;
