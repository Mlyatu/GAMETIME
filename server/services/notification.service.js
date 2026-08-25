// =====================================================================
// NOTIFICATION SERVICE
// =====================================================================
// Single entry point the rest of the app calls to notify a user:
// writes the notification row (so it's there on next login even if
// they're offline right now) and, if a Socket.io server is running
// and the user has a connection open, pushes it live too.
// =====================================================================

const { query } = require('../config/database');
const notificationModel = require('../models/notification.model');
const { getIO } = require('../socket');

/**
 * @param {number} userId - internal user id (FK target)
 * @param {object} payload
 * @param {string} payload.type - e.g. 'payment_approved', 'match_scheduled'
 * @param {string} payload.title
 * @param {string} [payload.body]
 * @param {string} [payload.linkUrl]
 * @param {string} [userUuid] - pass if already known, saves a lookup query
 */
async function notifyUser(userId, payload, userUuid = null) {
  const notification = await notificationModel.create({ userId, ...payload });

  try {
    const io = getIO();
    if (io) {
      let uuid = userUuid;
      if (!uuid) {
        const result = await query('SELECT uuid FROM users WHERE id = $1', [userId]);
        uuid = result.rows[0]?.uuid;
      }
      if (uuid) {
        io.to(`user:${uuid}`).emit('notification:new', notification);
      }
    }
  } catch (err) {
    // A failed real-time push should never fail the calling action —
    // the notification is already safely persisted above.
    // eslint-disable-next-line no-console
    console.error('Failed to push live notification:', err.message);
  }

  return notification;
}

module.exports = { notifyUser };
