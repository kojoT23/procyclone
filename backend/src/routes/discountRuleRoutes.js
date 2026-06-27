const express = require('express');
const router  = express.Router();
const {
  getDiscountRules, createDiscountRule, updateDiscountRule, deleteDiscountRule,
  discountRuleValidation,
} = require('../controllers/discountRuleController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const audit    = require('../middleware/auditLog');

router.use(protect);

router.get('/', getDiscountRules);

router.post('/',
  authorize('super_admin'),
  [...discountRuleValidation], validate,
  audit('CREATE_DISCOUNT_RULE', 'discount_rule',
    (req, data) => data.rule?.id,
    (req, data) => `Created discount rule "${data.rule?.label}" — ${data.rule?.discount_value}${data.rule?.discount_type === 'percent' ? '%' : ' GH₵'}`
  ),
  createDiscountRule
);

router.put('/:id',
  authorize('super_admin'),
  [...discountRuleValidation], validate,
  audit('UPDATE_DISCOUNT_RULE', 'discount_rule',
    (req) => parseInt(req.params.id),
    (req, data) => `Updated discount rule "${data.rule?.label}"`
  ),
  updateDiscountRule
);

router.delete('/:id',
  authorize('super_admin'),
  audit('DELETE_DISCOUNT_RULE', 'discount_rule',
    (req) => parseInt(req.params.id),
    (req, data) => data.message
  ),
  deleteDiscountRule
);

module.exports = router;
