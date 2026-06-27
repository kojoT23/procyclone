const express = require('express');
const router  = express.Router();
const {
  getBusinessProfile, updateBusinessProfile, updateBusinessProfileValidation,
} = require('../controllers/businessProfileController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

// Any authenticated user can read business details (receipts, settings page, etc.)
router.get('/', getBusinessProfile);

// Only super_admin can edit — business identity/MoMo number is sensitive
router.put('/',
  authorize('super_admin'),
  [...updateBusinessProfileValidation], validate,
  audit('UPDATE_BUSINESS_PROFILE', 'business_profile',
    () => 1,
    (req, data) => `Updated business profile — ${data.profile?.business_name}`
  ),
  updateBusinessProfile
);

module.exports = router;
