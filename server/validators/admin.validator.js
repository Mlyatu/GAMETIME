// =====================================================================
// ADMIN VALIDATORS
// =====================================================================
// express-validator rule sets for the admin user-management endpoints.
// Routes attach these, then call handleValidationErrors to reject bad
// input before it reaches the controller.
// =====================================================================

const { body, query: queryValidator, param } = require('express-validator');

const listUsersValidator = [
  queryValidator('page').optional().isInt({ min: 1 }).toInt(),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  queryValidator('search').optional().trim(),
];

const createUserValidator = [
  body('fullName').trim().notEmpty().withMessage('Full name is required')
    .isLength({ max: 100 }).withMessage('Full name must be under 100 characters'),
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('role').optional().isIn(['player', 'moderator', 'admin']).withMessage('Role must be player, moderator, or admin'),
  body('gamerTag').optional().trim().isLength({ max: 50 }).withMessage('Gamer tag must be under 50 characters'),
];

const deleteUserValidator = [
  param('uuid').isUUID().withMessage('A valid user id is required'),
];

const updateUserRoleValidator = [
  param('uuid').isUUID().withMessage('A valid user id is required'),
  body('role').isIn(['player', 'moderator', 'admin']).withMessage('Role must be player, moderator, or admin'),
];

module.exports = { listUsersValidator, createUserValidator, updateUserRoleValidator, deleteUserValidator };
