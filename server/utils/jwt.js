// =====================================================================
// JWT HELPERS
// =====================================================================
// Two separate secrets/tokens by design:
//  - Access token: short-lived (default 7d here, but meant to be much
//    shorter in production — see note below), sent on every request.
//  - Refresh token: longer-lived, used only to obtain a new access
//    token, stored hashed in `auth_tokens` so it can be revoked.
// Using two secrets means a leaked access-token secret alone can't be
// used to forge refresh tokens, and vice versa.
// =====================================================================

const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret, which would make every token forgeable.
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in .env');
}

/**
 * Sign a short-lived access token carrying the minimum identity claims
 * needed to authorize requests. Never put sensitive data (password
 * hash, raw email) in here — JWT payloads are base64, not encrypted.
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.uuid, role: user.role, username: user.username },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

/** Sign a longer-lived refresh token. Payload is minimal on purpose. */
function signRefreshToken(user) {
  return jwt.sign({ sub: user.uuid }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

/** Verify an access token; throws if invalid/expired. */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/** Verify a refresh token; throws if invalid/expired. */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
