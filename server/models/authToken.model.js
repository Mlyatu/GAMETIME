// =====================================================================
// AUTH TOKEN MODEL
// =====================================================================
// Handles the `auth_tokens` table: email verification tokens, password
// reset tokens, and refresh tokens. Only hashed tokens are ever stored
// (see utils/token.js) — lookups hash the incoming raw token and
// compare against the stored hash.
// =====================================================================

const { query } = require('../config/database');

/**
 * Store a new token record.
 * @param {number} userId
 * @param {string} tokenHash - SHA-256 hash of the raw token
 * @param {'email_verification'|'password_reset'|'refresh'} type
 * @param {Date} expiresAt
 */
async function createToken(userId, tokenHash, type, expiresAt) {
  const result = await query(
    `INSERT INTO auth_tokens (user_id, token_hash, type, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, tokenHash, type, expiresAt]
  );
  return result.rows[0].id;
}

/**
 * Find a still-valid (unused, unexpired) token by its hash and type.
 * Returns null if it doesn't exist, was already used, or has expired.
 */
async function findValidToken(tokenHash, type) {
  const result = await query(
    `SELECT * FROM auth_tokens
     WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash, type]
  );
  return result.rows[0] || null;
}

/** Mark a token as used so it can't be replayed. */
async function markTokenUsed(tokenId) {
  await query('UPDATE auth_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
}

/** Invalidate all outstanding tokens of a given type for a user (e.g. on password change). */
async function invalidateUserTokens(userId, type) {
  await query(
    'UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND type = $2 AND used_at IS NULL',
    [userId, type]
  );
}

module.exports = { createToken, findValidToken, markTokenUsed, invalidateUserTokens };
