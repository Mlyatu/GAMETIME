// =====================================================================
// MATCH MODEL
// =====================================================================

const { query, getClient } = require('../config/database');

/** Bulk-insert generated fixtures inside a single transaction. */
async function bulkCreateMatches(tournamentId, matches) {
  // matches: [{ uuid, round, homeParticipantId, awayParticipantId, scheduledAt }]
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const inserted = [];
    for (const m of matches) {
      const result = await client.query(
        `INSERT INTO matches (uuid, tournament_id, round, home_participant_id, away_participant_id, scheduled_at, status)
         VALUES ($1, $2, $3, $4::bigint, $5::bigint, $6,
           CASE WHEN $4::bigint IS NULL OR $5::bigint IS NULL THEN 'completed'::match_status ELSE 'scheduled'::match_status END)
         RETURNING id, uuid, round, home_participant_id, away_participant_id, status`,
        [m.uuid, tournamentId, m.round, m.homeParticipantId, m.awayParticipantId, m.scheduledAt || null]
      );
      const match = result.rows[0];

      // A bye (one side is null) is auto-completed with the present
      // side as the winner — no actual match needs to be played.
      if (m.homeParticipantId === null || m.awayParticipantId === null) {
        const winnerId = m.homeParticipantId ?? m.awayParticipantId;
        await client.query('UPDATE matches SET winner_participant_id = $2 WHERE id = $1', [match.id, winnerId]);
      }

      // Only uuid/round/status are safe to return to the API caller —
      // id and the participant FKs are internal (see database/README.md).
      inserted.push({ uuid: match.uuid, round: match.round, status: match.status });
    }
    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT m.uuid, m.round, m.scheduled_at, m.home_score, m.away_score, m.status, m.created_at,
            hp.uuid AS home_participant_uuid, hu.username AS home_username, ht.name AS home_team_name,
            ap.uuid AS away_participant_uuid, au.username AS away_username, at.name AS away_team_name,
            wp.uuid AS winner_participant_uuid
     FROM matches m
     LEFT JOIN tournament_participants hp ON hp.id = m.home_participant_id
     LEFT JOIN users hu ON hu.id = hp.user_id
     LEFT JOIN teams ht ON ht.id = hp.team_id
     LEFT JOIN tournament_participants ap ON ap.id = m.away_participant_id
     LEFT JOIN users au ON au.id = ap.user_id
     LEFT JOIN teams at ON at.id = ap.team_id
     LEFT JOIN tournament_participants wp ON wp.id = m.winner_participant_id
     WHERE m.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

/** Internal id + tournament_id — used by controllers that need to trigger standings recalculation. */
async function getInternalId(uuid) {
  const result = await query('SELECT id, tournament_id, status, home_participant_id, away_participant_id FROM matches WHERE uuid = $1', [uuid]);
  return result.rows[0] || null;
}

async function listByTournament(tournamentId, { round = null } = {}) {
  const params = [tournamentId];
  let where = 'WHERE m.tournament_id = $1';
  if (round) {
    params.push(round);
    where += ` AND m.round = $${params.length}`;
  }

  const result = await query(
    `SELECT m.uuid, m.round, m.scheduled_at, m.home_score, m.away_score, m.status,
            hu.username AS home_username, ht.name AS home_team_name,
            au.username AS away_username, at.name AS away_team_name
     FROM matches m
     LEFT JOIN tournament_participants hp ON hp.id = m.home_participant_id
     LEFT JOIN users hu ON hu.id = hp.user_id
     LEFT JOIN teams ht ON ht.id = hp.team_id
     LEFT JOIN tournament_participants ap ON ap.id = m.away_participant_id
     LEFT JOIN users au ON au.id = ap.user_id
     LEFT JOIN teams at ON at.id = ap.team_id
     ${where}
     ORDER BY m.round, m.scheduled_at NULLS LAST, m.id`,
    params
  );
  return result.rows;
}

/** Check whether any fixtures already exist for a tournament (prevents double-generation). */
async function tournamentHasMatches(tournamentId) {
  const result = await query('SELECT 1 FROM matches WHERE tournament_id = $1 LIMIT 1', [tournamentId]);
  return result.rowCount > 0;
}

/** Set the confirmed score for a match and mark it completed, determining the winner (or draw). */
async function setResult(matchId, { homeScore, awayScore }) {
  const winnerExpr = `
    CASE
      WHEN $2::int > $3::int THEN home_participant_id
      WHEN $3::int > $2::int THEN away_participant_id
      ELSE NULL
    END`;
  const result = await query(
    `UPDATE matches SET
       home_score = $2,
       away_score = $3,
       status = 'completed',
       winner_participant_id = ${winnerExpr}
     WHERE id = $1
     RETURNING id, tournament_id, home_participant_id, away_participant_id, home_score, away_score, winner_participant_id, status`,
    [matchId, homeScore, awayScore]
  );
  return result.rows[0] || null;
}

/** All completed matches for a tournament — the raw data standings are computed from. */
async function listCompletedByTournament(tournamentId) {
  const result = await query(
    `SELECT home_participant_id, away_participant_id, home_score, away_score, winner_participant_id
     FROM matches
     WHERE tournament_id = $1 AND status = 'completed'
       AND home_participant_id IS NOT NULL AND away_participant_id IS NOT NULL`,
    [tournamentId]
  );
  return result.rows;
}

module.exports = {
  bulkCreateMatches,
  findByUuid,
  getInternalId,
  listByTournament,
  tournamentHasMatches,
  setResult,
  listCompletedByTournament,
};
