// =====================================================================
// PLAYER ROUTES — /api/player
// =====================================================================

const express = require('express');
const router = express.Router();

const playerController = require('../controllers/player.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { avatarUpload } = require('../middleware/upload');
const { handleValidationErrors } = require('../validators/auth.validator');
const { updateProfileValidator, listPlayersValidator } = require('../validators/player.validator');

// Specific paths before the ':username' wildcard so they aren't swallowed by it.
router.get('/me', requireAuth, playerController.getMyProfile);
router.patch('/me', requireAuth, updateProfileValidator, handleValidationErrors, playerController.updateMyProfile);
router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), playerController.uploadAvatar);

router.get('/', requireAuth, requireRole('admin', 'moderator'), listPlayersValidator, handleValidationErrors, playerController.listPlayers);
router.get('/:username', playerController.getPublicProfile);

module.exports = router;
