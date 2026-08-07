const express = require('express');
const router = express.Router();
const { receiveFleepystoreOrder } = require('../controllers/webhookController');

// No `protect`/`authorize` middleware here on purpose — this is a
// server-to-server call from Fleepystore, not a logged-in Shorewinds
// user. Authentication instead happens via HMAC signature check
// inside receiveFleepystoreOrder (see webhookController.js).
router.post('/fleepystore', receiveFleepystoreOrder);

module.exports = router;
