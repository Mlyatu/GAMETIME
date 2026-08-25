// =====================================================================
// TOURNAMENT CONTROLLER
// =====================================================================

const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('../utils/asyncHandler');
const tournamentModel = require('../models/tournament.model');
const teamModel = require('../models/team.model');
const userModel = require('../models/user.model');
const { notifyUser } = require('../services/notification.service');

/** POST /api/tournament — create a tournament (admin/moderator only, enforced by route middleware). */
const createTournament = asyncHandler(async (req, res) => {
  const creator = await userModel.findByUuid(req.user.uuid);
  const tournament = await tournamentModel.createTournament({
    uuid: uuidv4(),
    name: req.body.name,
    description: req.body.description,
    bannerUrl: req.body.bannerUrl,
    format: req.body.format,
    maxParticipants: req.body.maxParticipants,
    entryFee: req.body.entryFee || 0,
    registrationDeadline: req.body.registrationDeadline,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    createdByUserId: creator.id,
  });
  res.status(201).json({ success: true, message: 'Tournament created', data: { tournament } });
});

/** GET /api/tournament — public, paginated, filterable list. */
const listTournaments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, format } = req.query;
  const tournaments = await tournamentModel.listTournaments({ page, limit, status, format });
  res.status(200).json({ success: true, data: { tournaments, page: Number(page), limit: Number(limit) } });
});

/** GET /api/tournament/:uuid — full tournament detail. */
const getTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.findByUuid(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  res.status(200).json({ success: true, data: { tournament } });
});

/** PATCH /api/tournament/:uuid — update tournament (admin/moderator only). */
const updateTournament = asyncHandler(async (req, res) => {
  const internal = await tournamentModel.getInternalId(req.params.uuid);
  if (!internal) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const updated = await tournamentModel.updateTournament(internal.id, req.body);
  res.status(200).json({ success: true, message: 'Tournament updated', data: { tournament: updated } });
});

/** DELETE /api/tournament/:uuid — delete a tournament (admin only). */
const deleteTournament = asyncHandler(async (req, res) => {
  const internal = await tournamentModel.getInternalId(req.params.uuid);
  if (!internal) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  await tournamentModel.deleteTournament(internal.id);
  res.status(200).json({ success: true, message: 'Tournament deleted' });
});

/**
 * POST /api/tournament/:uuid/join
 * Body: { teamUuid? } — omit for solo entry, provide for a team entry.
 * The requesting player must be the team's captain to enter on its behalf.
 */
const joinTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  if (tournament.status !== 'registration_open') {
    return res.status(400).json({ success: false, message: 'Registration is not open for this tournament' });
  }
  if (tournament.registration_deadline && new Date(tournament.registration_deadline) < new Date()) {
    return res.status(400).json({ success: false, message: 'The registration deadline has passed' });
  }

  const approvedCount = await tournamentModel.countApprovedParticipants(tournament.id);
  if (approvedCount >= tournament.max_participants) {
    return res.status(400).json({ success: false, message: 'This tournament is full' });
  }

  const actingUser = await userModel.findByUuid(req.user.uuid);
  let userId = actingUser.id;
  let teamId = null;

  if (req.body.teamUuid) {
    const team = await teamModel.getInternalId(req.body.teamUuid);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    if (team.captain_id !== actingUser.id) {
      return res.status(403).json({ success: false, message: 'Only the team captain can register the team' });
    }
    teamId = team.id;
    userId = null;
  }

  const existing = await tournamentModel.findParticipant(tournament.id, { userId, teamId });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Already registered for this tournament' });
  }

  const participant = await tournamentModel.addParticipant(tournament.id, { userId, teamId });
  res.status(201).json({
    success: true,
    message: 'Registration submitted — awaiting approval',
    data: { participant },
  });
});

/** GET /api/tournament/:uuid/participants — list entrants, optionally filtered by status. */
const listParticipants = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const participants = await tournamentModel.listParticipants(tournament.id, { status: req.query.status });
  res.status(200).json({ success: true, data: { participants } });
});

/** PATCH /api/tournament/:uuid/participants/:participantUuid — approve/reject (admin/moderator only). */
const updateParticipantStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'" });
  }
  const participant = await tournamentModel.getParticipantByUuid(req.params.participantUuid);
  if (!participant) {
    return res.status(404).json({ success: false, message: 'Participant entry not found' });
  }

  const updated = await tournamentModel.updateParticipantStatusByUuid(req.params.participantUuid, status);

  // Solo entries have a user_id we can notify directly; team entries
  // are skipped here — notifying an entire team's roster individually
  // is a reasonable future enhancement, not core to this flow.
  if (participant.user_id) {
    const tournament = await tournamentModel.findByUuid(req.params.uuid);
    notifyUser(participant.user_id, {
      type: `tournament_registration_${status}`,
      title: status === 'approved' ? 'Registration approved' : 'Registration rejected',
      body: `Your entry into "${tournament?.name || 'the tournament'}" was ${status}.`,
      linkUrl: `/tournaments/${req.params.uuid}`,
    }).catch(() => {}); // never let a notification failure block the admin action
  }

  res.status(200).json({ success: true, message: `Participant ${status}`, data: { participant: updated } });
});

/** DELETE /api/tournament/:uuid/participants/me — the acting player withdraws themself (or their team, as captain). */
const withdrawFromTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const actingUser = await userModel.findByUuid(req.user.uuid);

  let teamId = null;
  if (req.body.teamUuid) {
    const team = await teamModel.getInternalId(req.body.teamUuid);
    if (!team || team.captain_id !== actingUser.id) {
      return res.status(403).json({ success: false, message: 'Only the team captain can withdraw the team' });
    }
    teamId = team.id;
  }

  const existing = await tournamentModel.findParticipant(tournament.id, {
    userId: teamId ? null : actingUser.id,
    teamId,
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'You are not registered for this tournament' });
  }

  await tournamentModel.updateParticipantStatusById(existing.id, 'withdrawn');
  res.status(200).json({ success: true, message: 'Withdrawn from the tournament' });
});

module.exports = {
  createTournament,
  listTournaments,
  getTournament,
  updateTournament,
  deleteTournament,
  joinTournament,
  listParticipants,
  updateParticipantStatus,
  withdrawFromTournament,
};
