// =====================================================================
// AUTH ROUTES
// =====================================================================
// All public routes are rate-limited with authLimiter. Controllers are
// wrapped with asyncHandler so thrown errors reach the central error
// handler and we don't need try/catch blocks inside every controller.
// =====================================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  refreshTokenValidator,
  handleValidationErrors,
} = require('../validators/auth.validator');

// Public routes — authLimiter caps attempts to slow brute-force/spam
router.post('/register', authLimiter, registerValidator, handleValidationErrors, asyncHandler(authController.register));
router.get('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/login', authLimiter, loginValidator, handleValidationErrors, asyncHandler(authController.login));
router.post('/refresh-token', refreshTokenValidator, handleValidationErrors, asyncHandler(authController.refreshToken));
router.post('/forgot-password', authLimiter, forgotPasswordValidator, handleValidationErrors, asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, resetPasswordValidator, handleValidationErrors, asyncHandler(authController.resetPassword));

// Protected routes — require a valid access token
router.get('/me', requireAuth, asyncHandler(authController.me));
router.post('/logout', requireAuth, asyncHandler(authController.logout));
router.post('/change-password', requireAuth, authLimiter, changePasswordValidator, handleValidationErrors, asyncHandler(authController.changePassword));

module.exports = router;
