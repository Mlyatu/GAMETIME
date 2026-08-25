// =====================================================================
// AUTH ROUTES — /api/auth
// =====================================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const requireAuth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  handleValidationErrors,
} = require('../validators/auth.validator');

// Public routes — authLimiter caps attempts to slow brute-force/spam
router.post('/register', authLimiter, registerValidator, handleValidationErrors, authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', authLimiter, loginValidator, handleValidationErrors, authController.login);
router.post('/refresh-token', refreshTokenValidator, handleValidationErrors, authController.refreshToken);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, handleValidationErrors, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, handleValidationErrors, authController.resetPassword);

// Protected routes — require a valid access token
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
