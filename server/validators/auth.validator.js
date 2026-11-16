// =====================================================================
// AUTH VALIDATORS
// =====================================================================
// express-validator rule chains. Routes attach these, then call
// handleValidationErrors as the next middleware to reject bad input
// before it ever reaches a controller.
// =====================================================================

const { body, validationResult } = require('express-validator');

function normalizePhoneNumber(value) {
  const compact = value.replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(compact)) return `+255${compact.slice(1)}`;
  if (/^255\d{9}$/.test(compact)) return `+${compact}`;
  if (/^00\d+$/.test(compact)) return `+${compact.slice(2)}`;
  return compact;
}

const registerValidator = [
  body('fullName').trim().notEmpty().withMessage('Full name is required')
    .isLength({ max: 100 }).withMessage('Full name must be under 100 characters'),
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required').bail()
    .customSanitizer(normalizePhoneNumber)
    .matches(/^\+[1-9]\d{7,14}$/).withMessage('Enter a valid phone number, e.g. 07XX XXX XXX or +2557XX XXX XXX'),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidator = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

const resendVerificationValidator = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

const verifyEmailValidator = [
  body('token').isString().notEmpty().withMessage('Verification token is required'),
];

const resetPasswordValidator = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

const refreshTokenValidator = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

/** Runs after any validator chain above; short-circuits with 422 on failure. */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resendVerificationValidator,
  verifyEmailValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  handleValidationErrors,
  normalizePhoneNumber,
};
