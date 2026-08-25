// =====================================================================
// CHAT CHANNEL MODEL
// =====================================================================

const { query } = require('../config/database');

/** The single global lobby channel, seeded by database/seed.sql. */
async function getGlobalChannelId() {
  const result = await query("SELECT id FROM chat_channels WHERE type = 'global' LIMIT 1");
  if (!result.rows[0]) {
    // Defensive fallback in case seed.sql wasn't run — create it on demand.
    const created = await query(
      "INSERT INTO chat_channels (name, type) VALUES ('Global Lobby', 'global') RETURNING id"
    );
    return created.rows[0].id;
  }
  return result.rows[0].id;
}

/** Get (or lazily create) the chat channel for a specific tournament. */
async function getOrCreateTournamentChannelId(tournamentId) {
  const existing = await query(
    "SELECT id FROM chat_channels WHERE type = 'tournament' AND tournament_id = $1",
    [tournamentId]
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const tournament = await query('SELECT name FROM tournaments WHERE id = $1', [tournamentId]);
  const name = tournament.rows[0] ? `${tournament.rows[0].name} Chat` : 'Tournament Chat';

  const created = await query(
    "INSERT INTO chat_channels (name, type, tournament_id) VALUES ($1, 'tournament', $2) RETURNING id",
    [name, tournamentId]
  );
  return created.rows[0].id;
}

module.exports = { getGlobalChannelId, getOrCreateTournamentChannelId };
