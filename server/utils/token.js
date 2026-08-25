// =====================================================================
// ONE-TIME TOKEN HELPERS (email verification / password reset)
// =====================================================================
// These are NOT JWTs — they're random strings emailed to the user as
// a link (e.g. /reset-password?token=...). Only the SHA-256 hash of
// the token is stored in `auth_tokens.token_hash`; the raw token never
// touches the database, so a DB leak alone can't be used to reset
// accounts.
// =====================================================================

const crypto = require('crypto');

/** Generate a raw, URL-safe random token to email to the user. */
function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Hash a raw token for storage/lookup — one-way, deterministic. */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateRawToken, hashToken };
