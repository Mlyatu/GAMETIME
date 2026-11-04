// =====================================================================
// ADMIN MODEL
// =====================================================================

const { query } = require('../config/database');

async function getOverview() {
  const [counts, activity, tournamentActivity] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM tournaments WHERE status IN ('registration_open', 'ongoing')) AS active_tournaments,
         (SELECT COUNT(*)::int FROM users WHERE role = 'player' AND deleted_at IS NULL) AS registered_players,
         (SELECT COUNT(*)::int FROM results WHERE verification_status = 'pending') AS pending_results,
         (SELECT COALESCE(SUM(prize_pool), 0)::numeric FROM tournaments) AS prize_volume,
         (SELECT COUNT(*)::int FROM matches WHERE status = 'completed' AND home_participant_id IS NOT NULL AND away_participant_id IS NOT NULL) AS matches_played,
         (SELECT COUNT(*)::int FROM matches WHERE status = 'completed' AND home_participant_id IS NOT NULL AND away_participant_id IS NOT NULL AND winner_participant_id IS NOT NULL) AS wins,
         (SELECT COALESCE(SUM(home_score + away_score), 0)::int FROM matches WHERE status = 'completed' AND home_participant_id IS NOT NULL AND away_participant_id IS NOT NULL) AS goals_scored,
         (SELECT COUNT(*)::int FROM matches WHERE status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at >= NOW())) AS upcoming_matches`
    ),
    query(
      `SELECT a.action, a.created_at, u.username
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 5`
    ),
    query(
      `SELECT uuid, name, status, updated_at
       FROM tournaments
       WHERE status IN ('registration_open', 'ongoing', 'completed')
       ORDER BY updated_at DESC
       LIMIT 5`
    ),
  ]);

  return {
    ...counts.rows[0],
    recent_activity: activity.rows,
    tournament_activity: tournamentActivity.rows,
  };
}

module.exports = { getOverview };