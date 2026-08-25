// =====================================================================
// PLAYER CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const playerModel = require('../models/player.model');

/** POST /api/player/me/avatar — upload/replace the logged-in player's avatar image. */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'An image file is required' });
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await playerModel.updateProfile(req.user.uuid, { avatarUrl });
  res.status(200).json({ success: true, message: 'Avatar updated', data: { avatarUrl } });
});

/** GET /api/player/me — the logged-in player's own full profile. */
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await playerModel.getOwnProfile(req.user.uuid);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }
  return res.status(200).json({ success: true, data: { profile } });
});

/** PATCH /api/player/me — update the logged-in player's own profile. */
const updateMyProfile = asyncHandler(async (req, res) => {
  await playerModel.updateProfile(req.user.uuid, req.body);
  const profile = await playerModel.getOwnProfile(req.user.uuid);
  return res.status(200).json({ success: true, message: 'Profile updated', data: { profile } });
});

/** GET /api/player/:username — public profile of any player. */
const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await playerModel.getPublicProfileByUsername(req.params.username);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Player not found' });
  }
  return res.status(200).json({ success: true, data: { profile } });
});

/** GET /api/player — paginated, searchable list of players. */
const listPlayers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const players = await playerModel.listPlayers({ page, limit, search });
  return res.status(200).json({ success: true, data: { players, page: Number(page), limit: Number(limit) } });
});

module.exports = { getMyProfile, updateMyProfile, uploadAvatar, getPublicProfile, listPlayers };
