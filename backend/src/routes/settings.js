const express = require('express');
const router  = express.Router();
const {
  getSystemStats,
  resetNotifications,
  resetDailyCounters,
  archiveAndReset,
  getResetLogs,
} = require('../controllers/settingsController');
const {
  getPortalAccessList,
  grantPortalAccess,
  revokePortalAccess,
} = require('../controllers/portalAccessController');
const { protect, authorize } = require('../middleware/auth');

/* All settings routes require authentication */
router.use(protect);

/* ── Stats & logs (admin + super_admin) ──────────────────────── */
router.get('/stats',      authorize('super_admin', 'admin'), getSystemStats);
router.get('/reset-logs', authorize('super_admin', 'admin'), getResetLogs);

/* ── Staff portal access (super_admin ONLY) ──────────────────────
   Mirrors how riders.user_id links a login to a rider profile —
   here, a row in staff_portal_access lets an admin/manager/
   super_admin user into the mobile portal at all. ──────────────── */
router.get('/portal-access',            authorize('super_admin'), getPortalAccessList);
router.post('/portal-access/:userId',   authorize('super_admin'), grantPortalAccess);
router.delete('/portal-access/:userId', authorize('super_admin'), revokePortalAccess);

/* ── Reset actions ───────────────────────────────────────────── */

/* Clear pending notifications — admin + super_admin */
router.post(
  '/reset/notifications',
  authorize('super_admin', 'admin'),
  resetNotifications
);

/* Reset daily counters — admin + super_admin */
router.post(
  '/reset/counters',
  authorize('super_admin', 'admin'),
  resetDailyCounters
);

/* Archive and full reset — super_admin ONLY */
router.post(
  '/reset/archive',
  authorize('super_admin'),
  archiveAndReset
);

module.exports = router;
