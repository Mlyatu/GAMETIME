// =====================================================================
// NOTIFICATION ROUTES — /api/notification
// =====================================================================

const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notification.controller');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, notificationController.listNotifications);
router.patch('/read-all', requireAuth, notificationController.markAllRead);
router.patch('/:id/read', requireAuth, notificationController.markRead);

module.exports = router;
