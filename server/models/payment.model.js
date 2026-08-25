// =====================================================================
// PAYMENT MODEL
// =====================================================================

const { query } = require('../config/database');

async function createPayment({
  uuid, userId, tournamentId, amount, currency, method, transactionReference, proofScreenshotUrl,
}) {
  const result = await query(
    `INSERT INTO payments
       (uuid, user_id, tournament_id, amount, currency, method, transaction_reference, proof_screenshot_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING uuid, amount, currency, method, status, created_at`,
    [uuid, userId, tournamentId, amount, currency, method, transactionReference, proofScreenshotUrl]
  );
  return result.rows[0];
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT p.uuid, p.amount, p.currency, p.method, p.transaction_reference, p.proof_screenshot_url,
            p.status, p.created_at, p.reviewed_at,
            u.uuid AS user_uuid, u.username,
            t.uuid AS tournament_uuid, t.name AS tournament_name,
            r.username AS reviewed_by_username
     FROM payments p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN tournaments t ON t.id = p.tournament_id
     LEFT JOIN users r ON r.id = p.reviewed_by
     WHERE p.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

/** Internal id + owning user id + tournament id — needed for ownership checks and auto-approving registration. */
async function getInternalId(uuid) {
  const result = await query('SELECT id, user_id, tournament_id, status FROM payments WHERE uuid = $1', [uuid]);
  return result.rows[0] || null;
}

async function listByUser(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT p.uuid, p.amount, p.currency, p.method, p.status, p.created_at,
            t.uuid AS tournament_uuid, t.name AS tournament_name
     FROM payments p
     LEFT JOIN tournaments t ON t.id = p.tournament_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

async function listAll({ page = 1, limit = 20, status = null, method = null }) {
  const offset = (page - 1) * limit;
  const params = [limit, offset];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (method) {
    params.push(method);
    conditions.push(`p.method = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT p.uuid, p.amount, p.currency, p.method, p.status, p.created_at,
            u.username, t.name AS tournament_name
     FROM payments p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN tournaments t ON t.id = p.tournament_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

/** Update status (approved/rejected/refunded) and stamp who reviewed it. */
async function updateStatus(paymentId, status, reviewerUserId) {
  const result = await query(
    `UPDATE payments SET status = $2, reviewed_by = $3, reviewed_at = NOW()
     WHERE id = $1
     RETURNING uuid, status, reviewed_at`,
    [paymentId, status, reviewerUserId]
  );
  return result.rows[0] || null;
}

module.exports = { createPayment, findByUuid, getInternalId, listByUser, listAll, updateStatus };
