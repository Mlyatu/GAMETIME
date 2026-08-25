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
async function createPlayer({ uuid, fullName, username, email, passwordHash, gamerTag }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (uuid, full_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'player')
       RETURNING id, uuid, full_name, username, email, role, is_email_verified, created_at`,
      [uuid, fullName, username, email, passwordHash]
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

/** Record the timestamp of a successful login. */
async function recordLogin(userId) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
}

module.exports = {
  findByEmail,
  findByUsername,
  findByUuid,
  createPlayer,
  markEmailVerified,
  updatePassword,
  recordLogin,
};
