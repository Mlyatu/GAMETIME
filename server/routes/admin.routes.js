// =====================================================================
// ADMIN ROUTES — /api/admin
// =====================================================================
// User administration. Every route requires a valid token (requireAuth)
// AND the admin role (requireRole). Handlers are wrapped with
// asyncHandler so thrown errors reach the central error handler.
// =====================================================================

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const asyncHandler = require('../utils/asyncHandler');
const { handleValidationErrors } = require('../validators/auth.validator');
const {
  listUsersValidator,
  createUserValidator,
  deleteUserValidator,
} = require('../validators/admin.validator');

// All admin routes require authentication + admin role.
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/users — list/search users (admin dashboard table)
router.get('/overview', asyncHandler(adminController.getOverview));
router.get('/users', listUsersValidator, handleValidationErrors, asyncHandler(adminController.listUsers));

// POST /api/admin/users — create a new account with a chosen role
router.post('/users', createUserValidator, handleValidationErrors, asyncHandler(adminController.createUser));

// DELETE /api/admin/users/:uuid — permanently remove a user
router.delete('/users/:uuid', deleteUserValidator, handleValidationErrors, asyncHandler(adminController.deleteUser));

module.exports = router;
