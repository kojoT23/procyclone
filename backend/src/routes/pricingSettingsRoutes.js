const express = require('express');
const router  = express.Router();
const {
  getPricingSettings, updatePricingSettings, pricingSettingsValidation,
} = require('../controllers/pricingSettingsController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

router.get('/', getPricingSettings);

router.put('/',
  authorize('super_admin'),
  [...pricingSettingsValidation], validate,
  audit('UPDATE_PRICING_SETTINGS', 'pricing_settings',
    () => 1,
    (req, data) => `Updated pricing settings — free delivery over GH₵${data.settings?.free_delivery_threshold ?? 'N/A'}, max discount ${data.settings?.max_manual_discount}${data.settings?.max_manual_discount_type === 'percent' ? '%' : ' GH₵'}`
  ),
  updatePricingSettings
);

module.exports = router;
