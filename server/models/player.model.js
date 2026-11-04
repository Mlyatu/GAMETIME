// =====================================================================
// PLAYER MODEL
// =====================================================================
// Player-facing data is a join of `users` (identity) and
// `player_profiles` (eFootball-specific fields). All queries here
// return that combined shape so controllers never have to stitch the
// two together themselves.
// =====================================================================

const { query } = require('../config/database');

const PROFILE_SELECT = `
  SELECT
    u.uuid, u.full_name, u.username, u.email, u.avatar_url, u.status, u.created_at,
    p.gamer_tag, p.platform, p.country, p.bio,
    COALESCE(stats.total_matches, 0)::int AS total_matches,
    COALESCE(stats.wins, 0)::int AS wins,
    COALESCE(stats.draws, 0)::int AS draws,
    COALESCE(stats.losses, 0)::int AS losses,
    COALESCE(stats.goals_scored, 0)::int AS goals_scored,
    COALESCE(stats.goals_conceded, 0)::int AS goals_conceded
  FROM users u
  JOIN player_profiles p ON p.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_matches,
           COUNT(*) FILTER (WHERE (m.home_participant_id = tp.id AND m.home_score > m.away_score)
                          OR (m.away_participant_id = tp.id AND m.away_score > m.home_score)) AS wins,
           COUNT(*) FILTER (WHERE m.home_score = m.away_score) AS draws,
           COUNT(*) FILTER (WHERE (m.home_participant_id = tp.id AND m.home_score < m.away_score)
                          OR (m.away_participant_id = tp.id AND m.away_score < m.home_score)) AS losses,
           COALESCE(SUM(CASE WHEN m.home_participant_id = tp.id THEN m.home_score ELSE m.away_score END), 0) AS goals_scored,
           COALESCE(SUM(CASE WHEN m.home_participant_id = tp.id THEN m.away_score ELSE m.home_score END), 0) AS goals_conceded
    FROM tournament_participants tp
    JOIN matches m ON (m.home_participant_id = tp.id OR m.away_participant_id = tp.id)
    WHERE (tp.user_id = u.id OR tp.team_id IN (
      SELECT tm.team_id FROM team_members tm WHERE tm.user_id = u.id
      UNION
      SELECT t.id FROM teams t WHERE t.captain_id = u.id
    )) AND m.status = 'completed'
      AND m.home_participant_id IS NOT NULL AND m.away_participant_id IS NOT NULL
  ) stats ON TRUE
`;

/** Full profile (including email) — only for the player viewing their own data. */
async function getOwnProfile(userUuid) {
  const result = await query(`${PROFILE_SELECT} WHERE u.uuid = $1 AND u.deleted_at IS NULL`, [userUuid]);
  return result.rows[0] || null;
}

/** Public profile lookup by username — used for viewing other players. */
async function getPublicProfileByUsername(username) {
  const result = await query(`${PROFILE_SELECT} WHERE u.username = $1 AND u.deleted_at IS NULL`, [username]);
  const row = result.rows[0];
  if (!row) return null;
  // Strip the email before returning — other players shouldn't see it.
  const { email, ...publicFields } = row;
  return publicFields;
}

/** Update the mutable parts of a player's profile. Only non-undefined fields are changed. */
async function updateProfile(userUuid, { fullName, avatarUrl, gamerTag, platform, country, bio }) {
  await query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       avatar_url = COALESCE($3, avatar_url)
     WHERE uuid = $1`,
    [userUuid, fullName, avatarUrl]
  );

  const result = await query(
    `UPDATE player_profiles SET
       gamer_tag = COALESCE($2, gamer_tag),
       platform = COALESCE($3, platform),
       country = COALESCE($4, country),
       bio = COALESCE($5, bio)
     WHERE user_id = (SELECT id FROM users WHERE uuid = $1)
     RETURNING user_id`,
    [userUuid, gamerTag, platform, country, bio]
  );

  return result.rows[0] || null;
}

/** Paginated list of players, optionally filtered by a search term on username/gamer tag. */
async function listPlayers({ page = 1, limit = 20, search = null }) {
  const offset = (page - 1) * limit;
  const params = [limit, offset];
  let where = "WHERE u.deleted_at IS NULL AND u.role = 'player'";

  if (search) {
    params.push(`%${search}%`);
    where += ` AND (u.username ILIKE $${params.length} OR p.gamer_tag ILIKE $${params.length})`;
  }

  const result = await query(
    `${PROFILE_SELECT} ${where} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows.map(({ email, ...rest }) => rest); // never expose emails in a list view
}

module.exports = { getOwnProfile, getPublicProfileByUsername, updateProfile, listPlayers };
