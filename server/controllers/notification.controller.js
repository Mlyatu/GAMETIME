// =====================================================================
// NOTIFICATION CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const notificationModel = require('../models/notification.model');
const userModel = require('../models/user.model');

/** GET /api/notification — the logged-in user's notifications (paginated, optionally unread-only). */
const listNotifications = asyncHandler(async (req, res) => {
  const actingUser = await userModel.findByUuid(req.user.uuid);
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const notifications = await notificationModel.listByUser(actingUser.id, {
    page, limit, unreadOnly: unreadOnly === 'true',
  });
  const unreadCount = await notificationModel.countUnread(actingUser.id);
  res.status(200).json({ success: true, data: { notifications, unreadCount } });
});

/** PATCH /api/notification/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const actingUser = await userModel.findByUuid(req.user.uuid);
  const updated = await notificationModel.markRead(req.params.id, actingUser.id);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }
  res.status(200).json({ success: true, message: 'Marked as read' });
});

/** PATCH /api/notification/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const actingUser = await userModel.findByUuid(req.user.uuid);
  await notificationModel.markAllRead(actingUser.id);
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

module.exports = { listNotifications, markRead, markAllRead };
