// =====================================================================
// STANDINGS SERVICE
// =====================================================================
// Pure aggregation logic (points/GD/ranking) plus the orchestration to
// recalculate and persist it. Called after every match completion so
// `standings` always reflects the latest confirmed results.
//
// Points: 3 for a win, 1 for a draw, 0 for a loss (standard football
// scoring — matches the "Auto Points" requirement).
// Ranking order: points desc, goal difference desc, goals for desc,
// then participant id asc as a stable final tiebreaker.
// =====================================================================

const matchModel = require('../models/match.model');
const standingsModel = require('../models/standings.model');

const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

/**
 * Pure function: given the set of completed matches and the full list
 * of participant ids that should appear in the table (even 0-play
 * participants show up with all zeros), return ranked standings rows.
 */
function calculateStandings(participantIds, completedMatches) {
  const table = new Map();
  participantIds.forEach((id) => {
    table.set(id, {
      participantId: id,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    });
  });

  completedMatches.forEach((m) => {
    const home = table.get(m.home_participant_id);
    const away = table.get(m.away_participant_id);
    if (!home || !away) return; // participant no longer in the active list (e.g. withdrawn) — skip

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.won += 1; home.points += POINTS_WIN;
      away.lost += 1; away.points += POINTS_LOSS;
    } else if (m.away_score > m.home_score) {
      away.won += 1; away.points += POINTS_WIN;
      home.lost += 1; home.points += POINTS_LOSS;
    } else {
      home.drawn += 1; home.points += POINTS_DRAW;
      away.drawn += 1; away.points += POINTS_DRAW;
    }
  });

  const rows = Array.from(table.values()).map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
  }));

  rows.sort((a, b) => (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.participantId - b.participantId
  ));

  rows.forEach((row, index) => { row.rank = index + 1; });

  return rows;
}

/** Recalculate and persist standings for a tournament from its completed matches. */
async function recalculateStandings(tournamentId, participantIds) {
  const completedMatches = await matchModel.listCompletedByTournament(tournamentId);
  const rows = calculateStandings(participantIds, completedMatches);
  await standingsModel.replaceStandings(tournamentId, rows);
  return rows;
}

module.exports = { calculateStandings, recalculateStandings };
