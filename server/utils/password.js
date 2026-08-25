// =====================================================================
// PASSWORD HASHING
// =====================================================================
// Centralizes bcrypt usage so the salt rounds are configured in one
// place and controllers never call bcrypt directly.
// =====================================================================

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12; // higher = slower to brute-force, but slower to hash too — 12 is a solid production default

/**
 * Hash a plaintext password before storing it.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, comparePassword };
