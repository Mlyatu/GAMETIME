// =====================================================================
// TEAM MODEL
// =====================================================================

const { query } = require('../config/database');

async function createTeam({ uuid, name, tag, captainUserId }) {
  const result = await query(
    `INSERT INTO teams (uuid, name, tag, captain_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, uuid, name, tag, logo_url, captain_id, created_at`,
    [uuid, name, tag, captainUserId]
  );
  const team = result.rows[0];

  // The captain is automatically a member of their own team.
  await query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [team.id, captainUserId]);

  // Internal id/captain_id are needed above for the membership insert,
  // but must never leave this module — only uuid-based fields are
  // public (see database/README.md: "never expose the auto-increment id").
  return { uuid: team.uuid, name: team.name, tag: team.tag, logoUrl: team.logo_url, createdAt: team.created_at };
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT t.uuid, t.name, t.tag, t.logo_url, t.created_at,
            u.uuid AS captain_uuid, u.username AS captain_username
     FROM teams t
     JOIN users u ON u.id = t.captain_id
     WHERE t.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

async function findByName(name) {
  const result = await query('SELECT id FROM teams WHERE name = $1', [name]);
  return result.rows[0] || null;
}

/** Internal numeric id lookup — used when a route only has the public uuid. */
async function getInternalId(uuid) {
  const result = await query('SELECT id, captain_id FROM teams WHERE uuid = $1', [uuid]);
  return result.rows[0] || null;
}

async function updateTeam(teamId, { name, tag, logoUrl }) {
  const result = await query(
    `UPDATE teams SET
       name = COALESCE($2, name),
       tag = COALESCE($3, tag),
       logo_url = COALESCE($4, logo_url)
     WHERE id = $1
     RETURNING uuid, name, tag, logo_url`,
    [teamId, name, tag, logoUrl]
  );
  return result.rows[0] || null;
}

async function deleteTeam(teamId) {
  await query('DELETE FROM teams WHERE id = $1', [teamId]);
}

async function listMembers(teamId) {
  const result = await query(
    `SELECT u.uuid, u.username, u.full_name, u.avatar_url, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at ASC`,
    [teamId]
  );
  return result.rows;
}

async function isMember(teamId, userId) {
  const result = await query('SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return result.rowCount > 0;
}

async function addMember(teamId, userId) {
  await query(
    'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT (team_id, user_id) DO NOTHING',
    [teamId, userId]
  );
}

async function removeMember(teamId, userId) {
  await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
}

async function listTeams({ page = 1, limit = 20, search = null }) {
  const offset = (page - 1) * limit;
  const params = [limit, offset];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE t.name ILIKE $${params.length} OR t.tag ILIKE $${params.length}`;
  }

  const result = await query(
    `SELECT t.uuid, t.name, t.tag, t.logo_url, t.created_at,
            u.username AS captain_username,
            (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
     FROM teams t
     JOIN users u ON u.id = t.captain_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

module.exports = {
  createTeam,
  findByUuid,
  findByName,
  getInternalId,
  updateTeam,
  deleteTeam,
  listMembers,
  isMember,
  addMember,
  removeMember,
  listTeams,
};
