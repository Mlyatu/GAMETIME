// =====================================================================
// MEDIA MODEL
// =====================================================================

const { query } = require('../config/database');

async function createMedia({ uploadedBy, tournamentId, type, fileUrl, caption }) {
  const result = await query(
    `INSERT INTO media (uploaded_by, tournament_id, type, file_url, caption)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING uuid, type, file_url, caption, created_at`,
    [uploadedBy, tournamentId, type, fileUrl, caption]
  );
  return result.rows[0];
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT m.uuid, m.type, m.file_url, m.caption, m.created_at,
            u.username AS uploaded_by_username,
            t.uuid AS tournament_uuid, t.name AS tournament_name
     FROM media m
     JOIN users u ON u.id = m.uploaded_by
     LEFT JOIN tournaments t ON t.id = m.tournament_id
     WHERE m.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

/** Internal id + uploader — used for ownership checks on delete. */
async function getInternalId(uuid) {
  const result = await query('SELECT id, uploaded_by FROM media WHERE uuid = $1', [uuid]);
  return result.rows[0] || null;
}

async function list({ tournamentUuid = null, type = null, page = 1, limit = 30 } = {}) {
  const offset = (page - 1) * limit;
  const params = [limit, offset];
  const conditions = [];

  if (tournamentUuid) {
    params.push(tournamentUuid);
    conditions.push(`t.uuid = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`m.type = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT m.uuid, m.type, m.file_url, m.caption, m.created_at,
            u.username AS uploaded_by_username,
            t.uuid AS tournament_uuid, t.name AS tournament_name
     FROM media m
     JOIN users u ON u.id = m.uploaded_by
     LEFT JOIN tournaments t ON t.id = m.tournament_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

async function deleteMedia(mediaId) {
  await query('DELETE FROM media WHERE id = $1', [mediaId]);
}

module.exports = { createMedia, findByUuid, getInternalId, list, deleteMedia };
