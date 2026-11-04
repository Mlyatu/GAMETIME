const { body, query: queryValidator } = require('express-validator');

const VALID_FORMATS = ['league', 'knockout', 'round_robin', 'swiss', 'groups'];
const VALID_STATUSES = ['draft', 'registration_open', 'ongoing', 'completed', 'cancelled'];

const createTournamentValidator = [
  body('name').trim().notEmpty().withMessage('Tournament name is required')
    .isLength({ max: 150 }).withMessage('Tournament name must be under 150 characters'),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('format').isIn(VALID_FORMATS).withMessage(`Format must be one of: ${VALID_FORMATS.join(', ')}`),
  body('maxParticipants').isInt({ min: 2 }).withMessage('Max participants must be at least 2'),
  body('entryFee').optional().isFloat({ min: 0 }).withMessage('Entry fee cannot be negative'),
  body('prizePool').optional().isFloat({ min: 0 }).withMessage('Prize pool cannot be negative'),
  body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('registrationDeadline').optional({ nullable: true }).isISO8601().withMessage('Registration deadline must be a valid date'),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('End date must be a valid date'),
];

const updateTournamentValidator = [
  body('name').optional().trim().isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('bannerUrl').optional({ nullable: true }).isURL(),
  body('format').optional().isIn(VALID_FORMATS).withMessage(`Format must be one of: ${VALID_FORMATS.join(', ')}`),
  body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('maxParticipants').optional().isInt({ min: 2 }),
  body('entryFee').optional().isFloat({ min: 0 }),
  body('prizePool').optional().isFloat({ min: 0 }),
  body('registrationDeadline').optional({ nullable: true }).isISO8601(),
  body('startDate').optional({ nullable: true }).isISO8601(),
  body('endDate').optional({ nullable: true }).isISO8601(),
];

const joinTournamentValidator = [
  body('teamUuid').optional().isUUID().withMessage('teamUuid must be a valid UUID'),
];

const listTournamentsValidator = [
  queryValidator('page').optional().isInt({ min: 1 }).toInt(),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  queryValidator('status').optional().isIn(VALID_STATUSES),
  queryValidator('format').optional().isIn(VALID_FORMATS),
];

module.exports = {
  createTournamentValidator,
  updateTournamentValidator,
  joinTournamentValidator,
  listTournamentsValidator,
};
