// =====================================================================
// CHAT ROUTES — /api/chat
// =====================================================================

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chat.controller');
const requireAuth = require('../middleware/auth');

router.get('/:channel/messages', requireAuth, chatController.getMessages);

module.exports = router;
