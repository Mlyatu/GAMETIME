// =====================================================================
// AUDIT LOG MODEL
// =====================================================================
// Write-side of the `audit_logs` table. Called from controllers that
// perform admin actions (payment approval, bans, etc.) so there's a
// record of who did what. Never blocks the calling action if logging
// itself fails — losing an audit entry shouldn't fail the request.
// =====================================================================

const { query } = require('../config/database');

/**
 * @param {object} params
 * @param {number|null} params.userId - acting user's internal id, or null for system actions
 * @param {string} params.action - e.g. 'payment.approved', 'payment.rejected'
 * @param {string} [params.entityType] - e.g. 'payment'
 * @param {number} [params.entityId] - the entity's internal id
 * @param {string} [params.ipAddress]
 * @param {object} [params.metadata] - arbitrary extra context, stored as JSONB
 */
async function record({ userId = null, action, entityType = null, entityId = null, ipAddress = null, metadata = null }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, ipAddress, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log entry:', err.message);
  }
}

module.exports = { record };
