// =====================================================================
// STANDINGS MODEL
// =====================================================================
// `standings` is a cache table (see database/README.md) — it's fully
// rebuilt by standings.service whenever a match completes, never
// hand-edited. These functions are deliberately simple: wipe and
// re-insert, rather than incremental updates, since recalculating
// from scratch is cheap at tournament scale and far less error-prone
// than trying to increment/decrement rows correctly.
// =====================================================================

const { query, getClient } = require('../config/database');

/** Replace all standings rows for a tournament in one transaction. */
async function replaceStandings(tournamentId, rows) {
  // rows: [{ participantId, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points, rank }]
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM standings WHERE tournament_id = $1', [tournamentId]);

    for (const row of rows) {
      await client.query(
        `INSERT INTO standings
           (tournament_id, participant_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points, rank)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          tournamentId, row.participantId, row.played, row.won, row.drawn, row.lost,
          row.goalsFor, row.goalsAgainst, row.goalDifference, row.points, row.rank,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listByTournament(tournamentId) {
  const result = await query(
    `SELECT s.rank, s.played, s.won, s.drawn, s.lost, s.goals_for, s.goals_against,
            s.goal_difference, s.points,
            u.username AS player_username, t.name AS team_name
     FROM standings s
     JOIN tournament_participants tp ON tp.id = s.participant_id
     LEFT JOIN users u ON u.id = tp.user_id
     LEFT JOIN teams t ON t.id = tp.team_id
     WHERE s.tournament_id = $1
     ORDER BY s.rank ASC`,
    [tournamentId]
  );
  return result.rows;
}

module.exports = { replaceStandings, listByTournament };
