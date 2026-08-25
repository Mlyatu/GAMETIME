#!/usr/bin/env node
// =====================================================================
// DATABASE MIGRATION RUNNER
// =====================================================================
// Applies database/schema.sql once on a fresh database, then runs any
// numbered .sql files from database/migrations/ in order, tracking them
// in schema_migrations so they are only applied once.
//
// Usage:
//   cp .env.example .env       # fill in your DB credentials
//   npm run db:migrate
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASELINE_FILE = path.join(__dirname, 'schema.sql');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isMigrated(file) {
  const result = await client.query('SELECT 1 FROM schema_migrations WHERE file = $1', [file]);
  return result.rowCount > 0;
}

async function recordMigration(file) {
  await client.query('INSERT INTO schema_migrations (file) VALUES ($1) ON CONFLICT (file) DO NOTHING', [file]);
}

async function runSqlFile(filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Applying ${label || path.basename(filePath)} ...`);
  await client.query(sql);
  // eslint-disable-next-line no-console
  console.log(`  done`);
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function main() {
  await client.connect();
  try {
    await ensureMigrationsTable();

    // Baseline schema: if the migrations table is empty and the users table
    // does not already exist, run schema.sql to create the initial tables.
    const baselineMigrated = await isMigrated('schema.sql');
    const usersExists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (!baselineMigrated && usersExists.rowCount === 0) {
      await runSqlFile(BASELINE_FILE, 'baseline schema.sql');
      await recordMigration('schema.sql');
    } else if (!baselineMigrated && usersExists.rowCount > 0) {
      // Schema already exists from a manual setup — just mark it tracked.
      // eslint-disable-next-line no-console
      console.log('Existing schema detected; marking schema.sql as applied.');
      await recordMigration('schema.sql');
    } else {
      // eslint-disable-next-line no-console
      console.log('schema.sql already applied.');
    }

    const files = await getMigrationFiles();
    for (const file of files) {
      if (await isMigrated(file)) {
        // eslint-disable-next-line no-console
        console.log(`Skipping already-applied migration: ${file}`);
        continue;
      }
      await runSqlFile(path.join(MIGRATIONS_DIR, file));
      await recordMigration(file);
    }

    // eslint-disable-next-line no-console
    console.log('\nDatabase migrations complete.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
