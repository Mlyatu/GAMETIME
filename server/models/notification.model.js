// =====================================================================
// NOTIFICATION MODEL
// =====================================================================

const { query } = require('../config/database');

async function create({ userId, type, title, body = null, linkUrl = null }) {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, link_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, title, body, link_url, is_read, created_at`,
    [userId, type, title, body, linkUrl]
  );
  return result.rows[0];
}

async function listByUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const offset = (page - 1) * limit;
  const params = [userId, limit, offset];
  const unreadClause = unreadOnly ? 'AND is_read = FALSE' : '';

  const result = await query(
    `SELECT id, type, title, body, link_url, is_read, created_at
     FROM notifications
     WHERE user_id = $1 ${unreadClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );
  return result.rows;
}

async function countUnread(userId) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return result.rows[0].count;
}

/** Mark one notification read — scoped to userId so one user can't mark another's as read. */
async function markRead(notificationId, userId) {
  const result = await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
    [notificationId, userId]
  );
  return result.rows[0] || null;
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [userId]);
}

module.exports = { create, listByUser, countUnread, markRead, markAllRead };
