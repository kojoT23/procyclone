const express = require('express');
const router = express.Router();
const {
  getComplianceItems,
  getComplianceItem,
  createComplianceItem,
  updateComplianceItem,
  deleteComplianceItem,
  fileComplianceItem,
} = require('../controllers/complianceController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);
router.use(authorize('super_admin', 'admin', 'manager'));

router.get('/', getComplianceItems);
router.get('/:id', getComplianceItem);

router.post('/',
  audit('CREATE_COMPLIANCE_ITEM', 'compliance_item',
    (req, data) => data.item?.id || null,
    (req, data) => data.message || `Created compliance item "${req.body.title}"`
  ),
  createComplianceItem
);

router.put('/:id',
  audit('UPDATE_COMPLIANCE_ITEM', 'compliance_item',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Updated compliance item #${req.params.id}`
  ),
  updateComplianceItem
);

router.put('/:id/file',
  audit('FILE_COMPLIANCE_ITEM', 'compliance_item',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Marked compliance item #${req.params.id} as filed`
  ),
  fileComplianceItem
);

router.delete('/:id',
  audit('DELETE_COMPLIANCE_ITEM', 'compliance_item',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted compliance item #${req.params.id}`
  ),
  deleteComplianceItem
);

module.exports = router;
