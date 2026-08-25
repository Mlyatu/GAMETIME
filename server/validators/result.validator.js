const { body } = require('express-validator');

const submitResultValidator = [
  body('matchUuid').isUUID().withMessage('matchUuid must be a valid UUID'),
  body('claimedHomeScore').optional().isInt({ min: 0 }).withMessage('claimedHomeScore must be a non-negative integer'),
  body('claimedAwayScore').optional().isInt({ min: 0 }).withMessage('claimedAwayScore must be a non-negative integer'),
];

module.exports = { submitResultValidator };
