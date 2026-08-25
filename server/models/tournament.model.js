// =====================================================================
// TOURNAMENT MODEL
// =====================================================================

const { query } = require('../config/database');

async function createTournament({
  uuid, name, description, bannerUrl, format, maxParticipants,
  entryFee, registrationDeadline, startDate, endDate, createdByUserId,
}) {
  const result = await query(
    `INSERT INTO tournaments
       (uuid, name, description, banner_url, format, max_participants,
        entry_fee, registration_deadline, start_date, end_date, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
     RETURNING uuid, name, description, banner_url, format, max_participants,
               entry_fee, status, registration_deadline, start_date, end_date, created_at`,
    [uuid, name, description, bannerUrl, format, maxParticipants,
      entryFee, registrationDeadline, startDate, endDate, createdByUserId]
  );
  return result.rows[0];
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT t.uuid, t.name, t.description, t.banner_url, t.format, t.max_participants,
            t.entry_fee, t.prize_pool, t.status, t.registration_deadline, t.start_date,
            t.end_date, t.created_at, t.updated_at,
            u.username AS created_by_username,
            (SELECT COUNT(*) FROM tournament_participants tp
               WHERE tp.tournament_id = t.id AND tp.status = 'approved') AS approved_count
     FROM tournaments t
     JOIN users u ON u.id = t.created_by
     WHERE t.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

/** Internal numeric id + status — used by controllers needing the id for joins/updates. */
async function getInternalId(uuid) {
  const result = await query('SELECT id, status, max_participants, registration_deadline FROM tournaments WHERE uuid = $1', [uuid]);
  return result.rows[0] || null;
}

async function listTournaments({ page = 1, limit = 20, status = null, format = null }) {
  const offset = (page - 1) * limit;
  const params = [limit, offset];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (format) {
    params.push(format);
    conditions.push(`t.format = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT t.uuid, t.name, t.banner_url, t.format, t.status, t.max_participants,
            t.entry_fee, t.prize_pool, t.registration_deadline, t.start_date, t.end_date,
            (SELECT COUNT(*) FROM tournament_participants tp
               WHERE tp.tournament_id = t.id AND tp.status = 'approved') AS approved_count
     FROM tournaments t
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

async function updateTournament(tournamentId, fields) {
  const {
    name, description, bannerUrl, maxParticipants, entryFee, prizePool,
    status, registrationDeadline, startDate, endDate,
  } = fields;

  const result = await query(
    `UPDATE tournaments SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       banner_url = COALESCE($4, banner_url),
       max_participants = COALESCE($5, max_participants),
       entry_fee = COALESCE($6, entry_fee),
       prize_pool = COALESCE($7, prize_pool),
       status = COALESCE($8, status),
       registration_deadline = COALESCE($9, registration_deadline),
       start_date = COALESCE($10, start_date),
       end_date = COALESCE($11, end_date)
     WHERE id = $1
     RETURNING uuid, name, status`,
    [tournamentId, name, description, bannerUrl, maxParticipants, entryFee,
      prizePool, status, registrationDeadline, startDate, endDate]
  );
  return result.rows[0] || null;
}

async function deleteTournament(tournamentId) {
  await query('DELETE FROM tournaments WHERE id = $1', [tournamentId]);
}

// ---------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------

async function findParticipant(tournamentId, { userId = null, teamId = null }) {
  const result = await query(
    `SELECT * FROM tournament_participants
     WHERE tournament_id = $1 AND (user_id = $2 OR team_id = $3) AND status != 'withdrawn'`,
    [tournamentId, userId, teamId]
  );
  return result.rows[0] || null;
}

async function addParticipant(tournamentId, { userId = null, teamId = null }) {
  const result = await query(
    `INSERT INTO tournament_participants (tournament_id, user_id, team_id, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING uuid, status, joined_at`,
    [tournamentId, userId, teamId]
  );
  return result.rows[0];
}

async function listParticipants(tournamentId, { status = null } = {}) {
  const params = [tournamentId];
  let where = 'WHERE tp.tournament_id = $1';
  if (status) {
    params.push(status);
    where += ` AND tp.status = $${params.length}`;
  }

  const result = await query(
    `SELECT tp.uuid, tp.status, tp.seed, tp.group_label, tp.joined_at,
            u.uuid AS user_uuid, u.username AS user_username,
            tm.uuid AS team_uuid, tm.name AS team_name
     FROM tournament_participants tp
     LEFT JOIN users u ON u.id = tp.user_id
     LEFT JOIN teams tm ON tm.id = tp.team_id
     ${where}
     ORDER BY tp.joined_at ASC`,
    params
  );
  return result.rows;
}

/** Internal lookup by public uuid — used by controllers that need the row's internal fields (user_id, team_id) for notifications/ownership checks. */
async function getParticipantByUuid(participantUuid) {
  const result = await query(
    'SELECT id, uuid, tournament_id, user_id, team_id, status FROM tournament_participants WHERE uuid = $1',
    [participantUuid]
  );
  return result.rows[0] || null;
}

/** Internal lookup by internal id — used where a caller already has the numeric FK (e.g. matches.home_participant_id). */
async function getParticipantByInternalId(participantId) {
  const result = await query(
    'SELECT id, uuid, tournament_id, user_id, team_id, status FROM tournament_participants WHERE id = $1',
    [participantId]
  );
  return result.rows[0] || null;
}

/** Public-facing status transition, addressed by uuid — used by the admin approve/reject route. */
async function updateParticipantStatusByUuid(participantUuid, status) {
  const result = await query(
    `UPDATE tournament_participants SET status = $2 WHERE uuid = $1 RETURNING uuid, status`,
    [participantUuid, status]
  );
  return result.rows[0] || null;
}

/** Internal-id-addressed status transition — used by call sites that already hold a row from findParticipant() (e.g. self-withdrawal). */
async function updateParticipantStatusById(participantId, status) {
  const result = await query(
    `UPDATE tournament_participants SET status = $2 WHERE id = $1 RETURNING uuid, status`,
    [participantId, status]
  );
  return result.rows[0] || null;
}

async function countApprovedParticipants(tournamentId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM tournament_participants
     WHERE tournament_id = $1 AND status = 'approved'`,
    [tournamentId]
  );
  return result.rows[0].count;
}

module.exports = {
  createTournament,
  findByUuid,
  getInternalId,
  listTournaments,
  updateTournament,
  deleteTournament,
  findParticipant,
  getParticipantByUuid,
  getParticipantByInternalId,
  addParticipant,
  listParticipants,
  updateParticipantStatusByUuid,
  updateParticipantStatusById,
  countApprovedParticipants,
};
