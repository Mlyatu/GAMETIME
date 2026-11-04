const { body } = require('express-validator');

const submitScoreValidator = [
  body('homeScore').isInt({ min: 0 }).withMessage('Home score must be a non-negative integer'),
  body('awayScore').isInt({ min: 0 }).withMessage('Away score must be a non-negative integer'),
];

const scheduleMatchValidator = [
  body('scheduledAt').isISO8601().withMessage('A valid scheduled date and time is required'),
];

module.exports = { submitScoreValidator, scheduleMatchValidator };
