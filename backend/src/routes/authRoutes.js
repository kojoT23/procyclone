const express = require('express');
const router = express.Router();
const { login, refreshToken, getMe, changePassword, loginValidation, changePasswordValidation } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

router.post('/login', authLimiter, [...loginValidation], validate, login);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.put('/change-password', protect, [...changePasswordValidation], validate, changePassword);

module.exports = router;
