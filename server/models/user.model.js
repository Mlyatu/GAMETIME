// =====================================================================
// USER MODEL
// =====================================================================
// All raw SQL for `users` and `player_profiles` lives here. Controllers
// call these functions instead of writing SQL inline — this is the
// only file that needs to change if the users table structure evolves.
// Every query is parameterized ($1, $2, ...) to prevent SQL injection.
// =====================================================================

const { query, getClient } = require('../config/database');

/** Look up a user by email. Used during login and registration checks. */
async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
  return result.rows[0] || null;
}

/** Look up a user by username. Used during registration uniqueness checks. */
async function findByUsername(username) {
  const result = await query('SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
  return result.rows[0] || null;
}

/** Look up a user by their public UUID (never the internal serial id). */
async function findByUuid(uuid) {
  const result = await query('SELECT * FROM users WHERE uuid = $1 AND deleted_at IS NULL', [uuid]);
  return result.rows[0] || null;
}

/**
 * Create a new player account plus its player_profiles row, in a single
 * transaction — if the profile insert fails, the user insert is rolled
 * back too, so we never end up with a "player" who has no profile.
 */
async function createPlayer({ uuid, fullName, username, email, passwordHash, gamerTag, isEmailVerified = false }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (uuid, full_name, username, email, password_hash, role, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, 'player', $6)
       RETURNING id, uuid, full_name, username, email, role, is_email_verified, created_at`,
      [uuid, fullName, username, email, passwordHash, isEmailVerified]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO player_profiles (user_id, gamer_tag) VALUES ($1, $2)`,
      [user.id, gamerTag]
    );

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Mark a user's email as verified. */
async function markEmailVerified(userId) {
  await query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [userId]);
}

/** Update the password hash (used by reset-password flow). */
async function updatePassword(userId, passwordHash) {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

/**
 * Create a user with an explicit role (admin/moderator/player) — used by
 * the admin "add user" action. Admins are created pre-verified and active
 * so they can log in immediately. Players/moderators get a player_profile
 * row too (gamer_tag is required there).
 */
async function createUserByAdmin({ uuid, fullName, username, email, passwordHash, role, gamerTag, isEmailVerified = true }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (uuid, full_name, username, email, password_hash, role, is_email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING id, uuid, full_name, username, email, role, is_email_verified, status, created_at`,
      [uuid, fullName, username, email, passwordHash, role, isEmailVerified]
    );
    const user = userResult.rows[0];

    // Every role gets a player_profiles row (the schema expects a 1:1 and
    // several player-facing queries JOIN it unconditionally). Fall back to
    // the username when no gamer tag is supplied.
    await client.query(
      `INSERT INTO player_profiles (user_id, gamer_tag) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, gamerTag || username]
    );

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Permanently remove a user and everything that must go with them, in a
 * single transaction. Most child tables use ON DELETE CASCADE (profiles,
 * tokens, notifications, payments, media, team memberships, participations,
 * chat messages, verifications, captained teams) and are cleaned up
 * automatically by the final DELETE. The handful of NOT NULL foreign keys
 * WITHOUT cascade (tournaments.created_by, announcements.created_by,
 * results.submitted_by) are reassigned to the acting admin first so the
 * historical records survive; nullable reviewer FKs are nulled out.
 *
 * @param {number} userId           internal id of the user to delete
 * @param {number} reassignToUserId internal id of the admin performing it
 */
async function hardDeleteUser(userId, reassignToUserId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Reassign ownership of records that can't be nulled (NOT NULL FKs).
    await client.query('UPDATE tournaments SET created_by = $1 WHERE created_by = $2', [reassignToUserId, userId]);
    await client.query('UPDATE announcements SET created_by = $1 WHERE created_by = $2', [reassignToUserId, userId]);
    await client.query('UPDATE results SET submitted_by = $1 WHERE submitted_by = $2', [reassignToUserId, userId]);

    // Null out optional reviewer references so they don't block the delete.
    await client.query('UPDATE results SET verified_by = NULL WHERE verified_by = $1', [userId]);
    await client.query('UPDATE payments SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await client.query('UPDATE verifications SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [userId]);

    // The final delete cascades to profiles, tokens, notifications,
    // payments, media, team_members, tournament_participants,
    // chat_messages, verifications, and captained teams.
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Look up a user's internal id + role by public uuid (for admin actions). */
async function findByUuidWithRole(uuid) {
  const result = await query('SELECT id, uuid, username, role FROM users WHERE uuid = $1 AND deleted_at IS NULL', [uuid]);
  return result.rows[0] || null;
}

/** Count active (non-deleted) admins — used to protect the last admin. */
async function countAdmins() {
  const result = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND deleted_at IS NULL");
  return result.rows[0].count;
}

/** List all account roles for the admin user-management screen. */
async function listAdminUsers({ page = 1, limit = 20, search = null }) {
  const params = [limit, (page - 1) * limit];
  let where = 'WHERE u.deleted_at IS NULL';

  if (search) {
    params.push(`%${search}%`);
    where += ` AND (u.full_name ILIKE $${params.length}
      OR u.username ILIKE $${params.length}
      OR u.email ILIKE $${params.length}
      OR p.gamer_tag ILIKE $${params.length})`;
  }

  const result = await query(
    `SELECT u.uuid, u.full_name, u.username, u.email, u.role,
            u.is_email_verified, u.created_at, p.gamer_tag
     FROM users u
     LEFT JOIN player_profiles p ON p.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

/**
 * Change an account role while serializing role updates and protecting
 * the last administrator from being demoted.
 */
async function updateRoleByUuid(uuid, role) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT id FROM users
       WHERE role = 'admin' AND deleted_at IS NULL
       ORDER BY id FOR UPDATE`
    );

    const targetResult = await client.query(
      'SELECT id, uuid, username, role FROM users WHERE uuid = $1 AND deleted_at IS NULL FOR UPDATE',
      [uuid]
    );
    const target = targetResult.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return { status: 'not_found' };
    }

    if (target.role === role) {
      await client.query('COMMIT');
      return { status: 'unchanged', user: target };
    }

    if (target.role === 'admin' && role !== 'admin') {
      const admins = await client.query(
        "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL"
      );
      if (admins.rowCount <= 1) {
        await client.query('ROLLBACK');
        return { status: 'last_admin' };
      }
    }

    const result = await client.query(
      `UPDATE users SET role = $1
       WHERE id = $2
       RETURNING uuid, full_name, username, email, role, is_email_verified`,
      [role, target.id]
    );
    await client.query('COMMIT');
    return { status: 'updated', user: result.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Record the timestamp of a successful login. */
async function recordLogin(userId) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
}

module.exports = {
  findByEmail,
  findByUsername,
  findByUuid,
  createPlayer,
  createUserByAdmin,
  hardDeleteUser,
  findByUuidWithRole,
  countAdmins,
  listAdminUsers,
  updateRoleByUuid,
  markEmailVerified,
  updatePassword,
  recordLogin,
};
