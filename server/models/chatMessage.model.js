// =====================================================================
// CHAT MESSAGE MODEL
// =====================================================================

const { query } = require('../config/database');

async function createMessage(channelId, senderId, message) {
  const result = await query(
    `INSERT INTO chat_messages (channel_id, sender_id, message)
     VALUES ($1, $2, $3)
     RETURNING id, message, created_at`,
    [channelId, senderId, message]
  );
  return result.rows[0];
}

/**
 * Most recent messages in a channel, oldest-first (ready to render
 * top-to-bottom). `before` (a message id) supports "load older
 * messages" pagination — omit it for the initial/most-recent page.
 */
async function listMessages(channelId, { limit = 50, before = null } = {}) {
  const params = [channelId, limit];
  let cursorClause = '';
  if (before) {
    params.push(before);
    cursorClause = `AND cm.id < $${params.length}`;
  }

  const result = await query(
    `SELECT cm.id, cm.message, cm.created_at, u.uuid AS sender_uuid, u.username AS sender_username
     FROM chat_messages cm
     JOIN users u ON u.id = cm.sender_id
     WHERE cm.channel_id = $1 AND cm.is_deleted = FALSE ${cursorClause}
     ORDER BY cm.id DESC
     LIMIT $2`,
    params
  );
  return result.rows.reverse(); // oldest-first for display
}

async function softDeleteMessage(messageId) {
  await query('UPDATE chat_messages SET is_deleted = TRUE WHERE id = $1', [messageId]);
}

module.exports = { createMessage, listMessages, softDeleteMessage };
