// =====================================================================
// TOURNAMENT ROUTES — /api/tournament
// =====================================================================

const express = require('express');
const router = express.Router();

const tournamentController = require('../controllers/tournament.controller');
const matchController = require('../controllers/match.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { handleValidationErrors } = require('../validators/auth.validator');
const {
  createTournamentValidator,
  updateTournamentValidator,
  joinTournamentValidator,
  listTournamentsValidator,
} = require('../validators/tournament.validator');

// Public browsing
router.get('/', listTournamentsValidator, handleValidationErrors, tournamentController.listTournaments);
router.get('/:uuid', tournamentController.getTournament);
router.get('/:uuid/participants', tournamentController.listParticipants);
router.get('/:uuid/fixtures', matchController.listFixtures);
router.get('/:uuid/standings', matchController.getStandings);

// Fixture generation (admin/moderator only) — one-time per tournament,
// pairs approved participants according to the tournament's format.
router.post(
  '/:uuid/fixtures/generate',
  requireAuth,
  requireRole('admin', 'moderator'),
  matchController.generateFixtures
);

// Admin/moderator management
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'moderator'),
  createTournamentValidator,
  handleValidationErrors,
  tournamentController.createTournament
);
router.patch(
  '/:uuid',
  requireAuth,
  requireRole('admin', 'moderator'),
  updateTournamentValidator,
  handleValidationErrors,
  tournamentController.updateTournament
);
router.delete('/:uuid', requireAuth, requireRole('admin'), tournamentController.deleteTournament);
router.patch(
  '/:uuid/participants/:participantUuid',
  requireAuth,
  requireRole('admin', 'moderator'),
  tournamentController.updateParticipantStatus
);

// Player registration
router.post('/:uuid/join', requireAuth, joinTournamentValidator, handleValidationErrors, tournamentController.joinTournament);
router.delete('/:uuid/participants/me', requireAuth, tournamentController.withdrawFromTournament);

module.exports = router;
