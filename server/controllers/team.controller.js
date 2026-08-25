// =====================================================================
// TEAM CONTROLLER
// =====================================================================

const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('../utils/asyncHandler');
const teamModel = require('../models/team.model');
const userModel = require('../models/user.model');

/** POST /api/team — create a team; the creator becomes captain. */
const createTeam = asyncHandler(async (req, res) => {
  const { name, tag } = req.body;

  const existing = await teamModel.findByName(name);
  if (existing) {
    return res.status(409).json({ success: false, message: 'A team with this name already exists' });
  }

  const captain = await userModel.findByUuid(req.user.uuid);
  const team = await teamModel.createTeam({ uuid: uuidv4(), name, tag, captainUserId: captain.id });

  return res.status(201).json({ success: true, message: 'Team created', data: { team } });
});

/** GET /api/team/:uuid — team details + member list. */
const getTeam = asyncHandler(async (req, res) => {
  const team = await teamModel.findByUuid(req.params.uuid);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }
  const internal = await teamModel.getInternalId(req.params.uuid);
  const members = await teamModel.listMembers(internal.id);
  return res.status(200).json({ success: true, data: { team, members } });
});

/** GET /api/team — paginated, searchable list of teams. */
const listTeams = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const teams = await teamModel.listTeams({ page, limit, search });
  return res.status(200).json({ success: true, data: { teams, page: Number(page), limit: Number(limit) } });
});

/** Shared guard: only the team's captain (or an admin) may modify it. Sends the response itself on failure. */
async function assertCanManageTeam(req, res, teamUuid) {
  const team = await teamModel.getInternalId(teamUuid);
  if (!team) {
    res.status(404).json({ success: false, message: 'Team not found' });
    return null;
  }
  const actingUser = await userModel.findByUuid(req.user.uuid);
  const isCaptain = team.captain_id === actingUser.id;
  const isAdmin = req.user.role === 'admin';
  if (!isCaptain && !isAdmin) {
    res.status(403).json({ success: false, message: 'Only the team captain or an admin can do this' });
    return null;
  }
  return team;
}

/** PATCH /api/team/:uuid — update team details (captain or admin only). */
const updateTeam = asyncHandler(async (req, res) => {
  const team = await assertCanManageTeam(req, res, req.params.uuid);
  if (!team) return;

  const updated = await teamModel.updateTeam(team.id, req.body);
  res.status(200).json({ success: true, message: 'Team updated', data: { team: updated } });
});

/** DELETE /api/team/:uuid — delete a team (captain or admin only). */
const deleteTeam = asyncHandler(async (req, res) => {
  const team = await assertCanManageTeam(req, res, req.params.uuid);
  if (!team) return;

  await teamModel.deleteTeam(team.id);
  res.status(200).json({ success: true, message: 'Team deleted' });
});

/** POST /api/team/:uuid/members — add a player to the team (captain or admin only). */
const addMember = asyncHandler(async (req, res) => {
  const team = await assertCanManageTeam(req, res, req.params.uuid);
  if (!team) return;

  const player = await userModel.findByUsername(req.body.username);
  if (!player) {
    return res.status(404).json({ success: false, message: 'No player found with that username' });
  }

  await teamModel.addMember(team.id, player.id);
  res.status(200).json({ success: true, message: 'Player added to the team' });
});

/** DELETE /api/team/:uuid/members/:username — remove a member (captain or admin only). */
const removeMember = asyncHandler(async (req, res) => {
  const team = await assertCanManageTeam(req, res, req.params.uuid);
  if (!team) return;

  const player = await userModel.findByUsername(req.params.username);
  if (!player) {
    return res.status(404).json({ success: false, message: 'No player found with that username' });
  }
  if (player.id === team.captain_id) {
    return res.status(400).json({ success: false, message: 'The captain cannot be removed from their own team' });
  }

  await teamModel.removeMember(team.id, player.id);
  res.status(200).json({ success: true, message: 'Player removed from the team' });
});

module.exports = { createTeam, getTeam, listTeams, updateTeam, deleteTeam, addMember, removeMember };
