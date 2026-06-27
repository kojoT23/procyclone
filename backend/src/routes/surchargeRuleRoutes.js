const express = require('express');
const router  = express.Router();
const {
  getSurchargeRules, createSurchargeRule, updateSurchargeRule, deleteSurchargeRule,
  surchargeRuleValidation,
} = require('../controllers/surchargeRuleController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

router.get('/', getSurchargeRules);

router.post('/',
  authorize('super_admin'),
  [...surchargeRuleValidation], validate,
  audit('CREATE_SURCHARGE_RULE', 'surcharge_rule',
    (req, data) => data.rule?.id,
    (req, data) => `Created surcharge rule "${data.rule?.label}" — ${data.rule?.surcharge_value}${data.rule?.surcharge_type === 'percent' ? '%' : ' GH₵'}`
  ),
  createSurchargeRule
);

router.put('/:id',
  authorize('super_admin'),
  [...surchargeRuleValidation], validate,
  audit('UPDATE_SURCHARGE_RULE', 'surcharge_rule',
    (req) => parseInt(req.params.id),
    (req, data) => `Updated surcharge rule "${data.rule?.label}"`
  ),
  updateSurchargeRule
);

router.delete('/:id',
  authorize('super_admin'),
  audit('DELETE_SURCHARGE_RULE', 'surcharge_rule',
    (req) => parseInt(req.params.id),
    (req, data) => data.message
  ),
  deleteSurchargeRule
);

module.exports = router;
