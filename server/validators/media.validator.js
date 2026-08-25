const { body } = require('express-validator');

const VALID_TYPES = ['poster', 'video', 'banner', 'background', 'logo', 'gallery'];

const uploadMediaValidator = [
  body('type').isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
  body('tournamentUuid').optional().isUUID().withMessage('tournamentUuid must be a valid UUID'),
  body('caption').optional().trim().isLength({ max: 255 }),
];

module.exports = { uploadMediaValidator };
