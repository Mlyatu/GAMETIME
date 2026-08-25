// =====================================================================
// DATABASE CONNECTION (PostgreSQL)
// =====================================================================
// A single shared connection pool for the whole app. Controllers and
// models import { query } from here instead of opening their own
// connections — pooling avoids the overhead of a fresh TCP + auth
// handshake on every request.
// =====================================================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Managed Postgres providers (Render, Railway, RDS, etc.) usually
  // require SSL. Set DB_SSL=true in .env for those environments.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,                     // max simultaneous connections in the pool
  idleTimeoutMillis: 30000,    // close idle clients after 30s
  connectionTimeoutMillis: 5000, // fail fast if the DB is unreachable
});

pool.on('error', (err) => {
  // Fires on idle-client errors (e.g. the DB restarts) — log it instead
  // of crashing the whole process.
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Run a parameterized query against the pool.
 * Always use parameterized queries ($1, $2, ...) — never string-
 * concatenate user input into SQL, which is how SQL injection happens.
 *
 * @param {string} text - SQL query with $1, $2... placeholders
 * @param {Array}  params - values to bind to the placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Get a dedicated client from the pool for running a multi-statement
 * transaction (BEGIN / COMMIT / ROLLBACK). Caller MUST release() it.
 *
 * Example:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('...');
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 */
async function getClient() {
  return pool.connect();
}

/** Quick health check used by the /health route and startup log. */
async function testConnection() {
  const result = await pool.query('SELECT NOW()');
  return result.rows[0];
}

module.exports = { pool, query, getClient, testConnection };
