const express = require('express');
const router = express.Router();
const {
  requestReset,
  verifyToken,
  resetPassword,
  requestResetValidation,
  resetPasswordValidation,
} = require('../controllers/passwordResetController');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

router.post('/request', authLimiter, [...requestResetValidation], validate, requestReset);
router.get('/verify/:token', verifyToken);
router.post('/reset', [...resetPasswordValidation], validate, resetPassword);

module.exports = router;