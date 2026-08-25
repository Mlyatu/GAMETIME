// =====================================================================
// MEDIA CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const mediaModel = require('../models/media.model');
const userModel = require('../models/user.model');
const tournamentModel = require('../models/tournament.model');

const VALID_TYPES = ['poster', 'video', 'banner', 'background', 'logo', 'gallery'];

/** POST /api/media — admin/moderator uploads a poster/banner/logo/gallery image or video. */
const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A file is required' });
  }
  if (!VALID_TYPES.includes(req.body.type)) {
    return res.status(400).json({ success: false, message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  let tournamentId = null;
  if (req.body.tournamentUuid) {
    const tournament = await tournamentModel.getInternalId(req.body.tournamentUuid);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    tournamentId = tournament.id;
  }

  const uploader = await userModel.findByUuid(req.user.uuid);
  const fileUrl = `/uploads/media/${req.file.filename}`;

  const media = await mediaModel.createMedia({
    uploadedBy: uploader.id,
    tournamentId,
    type: req.body.type,
    fileUrl,
    caption: req.body.caption || null,
  });

  res.status(201).json({ success: true, message: 'Media uploaded', data: { media } });
});

/** GET /api/media — public gallery listing, filterable by tournament/type. */
const listMedia = asyncHandler(async (req, res) => {
  const { tournamentUuid, type, page = 1, limit = 30 } = req.query;
  const media = await mediaModel.list({ tournamentUuid, type, page, limit });
  res.status(200).json({ success: true, data: { media } });
});

/** GET /api/media/:uuid */
const getMedia = asyncHandler(async (req, res) => {
  const media = await mediaModel.findByUuid(req.params.uuid);
  if (!media) {
    return res.status(404).json({ success: false, message: 'Media not found' });
  }
  res.status(200).json({ success: true, data: { media } });
});

/** DELETE /api/media/:uuid — uploader or admin only. */
const deleteMedia = asyncHandler(async (req, res) => {
  const media = await mediaModel.getInternalId(req.params.uuid);
  if (!media) {
    return res.status(404).json({ success: false, message: 'Media not found' });
  }
  const actingUser = await userModel.findByUuid(req.user.uuid);
  const isUploader = media.uploaded_by === actingUser.id;
  const isAdmin = req.user.role === 'admin';
  if (!isUploader && !isAdmin) {
    return res.status(403).json({ success: false, message: 'You do not have permission to delete this media' });
  }

  await mediaModel.deleteMedia(media.id);
  res.status(200).json({ success: true, message: 'Media deleted' });
});

module.exports = { uploadMedia, listMedia, getMedia, deleteMedia };
