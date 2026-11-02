const express = require('express');
const router = express.Router();
const { getDeliveryZones, checkout } = require('../controllers/storefrontController');

// Both public — no login. First-party endpoints called by the React
// storefront itself, same trust level as POS self-checkout.
router.get('/delivery-zones', getDeliveryZones);
router.post('/checkout', checkout);

module.exports = router;
