// =====================================================================
// MATCH CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const matchModel = require('../models/match.model');
const tournamentModel = require('../models/tournament.model');
const fixtureService = require('../services/fixture.service');
const standingsService = require('../services/standings.service');
const standingsModel = require('../models/standings.model');
const { query } = require('../config/database');
const { notifyUser } = require('../services/notification.service');
const auditLogModel = require('../models/auditLog.model');
const userModel = require('../models/user.model');

/** POST /api/tournament/:uuid/fixtures/generate — admin/moderator only. */
const generateFixtures = asyncHandler(async (req, res) => {
  const matches = await fixtureService.generateFixtures(req.params.uuid);
  const actor = await userModel.findByUuid(req.user.uuid);
  await auditLogModel.record({ userId: actor.id, action: 'fixtures.generated', entityType: 'tournament', metadata: { tournamentUuid: req.params.uuid, matchCount: matches.length }, ipAddress: req.ip });
  res.status(201).json({
    success: true,
    message: `${matches.length} fixture(s) generated`,
    data: { matches },
  });
});

/** GET /api/tournament/:uuid/fixtures — list all matches for a tournament, optionally filtered by round. */
const listFixtures = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const matches = await matchModel.listByTournament(tournament.id, { round: req.query.round });
  res.status(200).json({ success: true, data: { matches } });
});

/** GET /api/match/:uuid — full detail for a single match. */
const getMatch = asyncHandler(async (req, res) => {
  const match = await matchModel.findByUuid(req.params.uuid);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  res.status(200).json({ success: true, data: { match } });
});

/** PATCH /api/match/:uuid/schedule — admin/moderator schedules a fixture. */
const scheduleMatch = asyncHandler(async (req, res) => {
  const match = await matchModel.getInternalId(req.params.uuid);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  const updated = await matchModel.scheduleMatch(match.id, req.body.scheduledAt);
  if (!updated) {
    return res.status(400).json({ success: false, message: 'Only scheduled matches can be rescheduled' });
  }
  const actor = await userModel.findByUuid(req.user.uuid);
  await auditLogModel.record({ userId: actor.id, action: 'match.scheduled', entityType: 'match', metadata: { matchUuid: match.uuid, scheduledAt: updated.scheduled_at }, ipAddress: req.ip });
  return res.status(200).json({ success: true, message: 'Match scheduled', data: { match: updated } });
});

/**
 * PATCH /api/match/:uuid/score — admin/moderator sets the confirmed
 * score. Recalculates standings for the tournament immediately after,
 * so the leaderboard is always in sync with the latest completed match.
 *
 * NOTE: this is the same completion path that Step 9 (OCR result
 * verification) will call once a submitted screenshot result is
 * approved — approving a `results` row will end up calling
 * matchModel.setResult + standingsService.recalculateStandings, same
 * as this manual admin entry point does now.
 */
const submitScore = asyncHandler(async (req, res) => {
  const match = await matchModel.getInternalId(req.params.uuid);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  if (match.home_participant_id === null || match.away_participant_id === null) {
    return res.status(400).json({ success: false, message: 'This match is a bye and has no score to set' });
  }

  const { homeScore, awayScore } = req.body;
  await matchModel.setResult(match.id, { homeScore, awayScore });

  // Notify both sides of the completed match — solo participants only
  // (team notifications would need fanning out to every member, a
  // reasonable future enhancement rather than core to this flow).
  const [homeParticipant, awayParticipant] = await Promise.all([
    tournamentModel.getParticipantByInternalId(match.home_participant_id),
    tournamentModel.getParticipantByInternalId(match.away_participant_id),
  ]);
  const scoreline = `${homeScore} - ${awayScore}`;
  if (homeParticipant?.user_id) {
    notifyUser(homeParticipant.user_id, {
      type: 'match_completed',
      title: 'Match result recorded',
      body: `Final score: ${scoreline}`,
      linkUrl: `/matches/${req.params.uuid}`,
    }).catch(() => {});
  }
  if (awayParticipant?.user_id) {
    notifyUser(awayParticipant.user_id, {
      type: 'match_completed',
      title: 'Match result recorded',
      body: `Final score: ${scoreline}`,
      linkUrl: `/matches/${req.params.uuid}`,
    }).catch(() => {});
  }

  // Recalculate against every participant still active in the
  // tournament (approved, not withdrawn) so a withdrawn player's old
  // results don't linger in the table.
  const approved = await tournamentModel.listParticipants(match.tournament_id, { status: 'approved' });
  const idsResult = await query(
    'SELECT id FROM tournament_participants WHERE tournament_id = $1 AND status = $2',
    [match.tournament_id, 'approved']
  );
  const participantIds = idsResult.rows.map((r) => r.id);

  const standings = await standingsService.recalculateStandings(match.tournament_id, participantIds);
  const actor = await userModel.findByUuid(req.user.uuid);
  await auditLogModel.record({ userId: actor.id, action: 'match.result_recorded', entityType: 'match', entityId: match.id, metadata: { homeScore, awayScore }, ipAddress: req.ip });

  res.status(200).json({
    success: true,
    message: 'Score recorded and standings updated',
    data: { standingsPreview: standings.slice(0, 5), totalParticipants: approved.length },
  });
});

/** GET /api/tournament/:uuid/standings — current ranked table. */
const getStandings = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const standings = await standingsModel.listByTournament(tournament.id);
  res.status(200).json({ success: true, data: { standings } });
});

module.exports = { generateFixtures, listFixtures, getMatch, scheduleMatch, submitScore, getStandings };
