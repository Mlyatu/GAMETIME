// =====================================================================
// MEDIA ROUTES — /api/media
// =====================================================================

const express = require('express');
const router = express.Router();

const mediaController = require('../controllers/media.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { mediaUpload } = require('../middleware/upload');
const { handleValidationErrors } = require('../validators/auth.validator');
const { uploadMediaValidator } = require('../validators/media.validator');

router.get('/', mediaController.listMedia);
router.get('/:uuid', mediaController.getMedia);

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'moderator'),
  mediaUpload.single('file'),
  uploadMediaValidator,
  handleValidationErrors,
  mediaController.uploadMedia
);

router.delete('/:uuid', requireAuth, mediaController.deleteMedia);

module.exports = router;
