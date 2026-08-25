const { body } = require('express-validator');

const createTeamValidator = [
  body('name').trim().notEmpty().withMessage('Team name is required')
    .isLength({ max: 100 }).withMessage('Team name must be under 100 characters'),
  body('tag').optional().trim().isLength({ max: 10 }).withMessage('Team tag must be 10 characters or fewer'),
];

const updateTeamValidator = [
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Team name must be under 100 characters'),
  body('tag').optional().trim().isLength({ max: 10 }).withMessage('Team tag must be 10 characters or fewer'),
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
];

const addMemberValidator = [
  body('username').trim().notEmpty().withMessage('Username of the player to add is required'),
];

module.exports = { createTeamValidator, updateTeamValidator, addMemberValidator };
