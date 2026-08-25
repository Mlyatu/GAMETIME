// =====================================================================
// MATCH ROUTES — /api/match
// =====================================================================
// Tournament-scoped match actions (generate fixtures, list fixtures,
// standings) live on /api/tournament/:uuid/... in tournament.routes.js
// since they always need a tournament in context. This file covers
// actions on a single already-known match.
// =====================================================================

const express = require('express');
const router = express.Router();

const matchController = require('../controllers/match.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { handleValidationErrors } = require('../validators/auth.validator');
const { submitScoreValidator } = require('../validators/match.validator');

router.get('/:uuid', matchController.getMatch);
router.patch(
  '/:uuid/score',
  requireAuth,
  requireRole('admin', 'moderator'),
  submitScoreValidator,
  handleValidationErrors,
  matchController.submitScore
);

module.exports = router;
