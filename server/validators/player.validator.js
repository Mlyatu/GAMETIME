const { body, query: queryValidator } = require('express-validator');

const updateProfileValidator = [
  body('fullName').optional().trim().isLength({ max: 100 }).withMessage('Full name must be under 100 characters'),
  body('gamerTag').optional().trim().isLength({ max: 50 }).withMessage('Gamer tag must be under 50 characters'),
  body('platform').optional().isIn(['mobile', 'ps', 'xbox', 'pc']).withMessage('Invalid platform'),
  body('country').optional().trim().isLength({ max: 60 }).withMessage('Country must be under 60 characters'),
  body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Bio must be under 1000 characters'),
  body('avatarUrl').optional().isURL().withMessage('Avatar URL must be a valid URL'),
];

const listPlayersValidator = [
  queryValidator('page').optional().isInt({ min: 1 }).toInt(),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

module.exports = { updateProfileValidator, listPlayersValidator };
