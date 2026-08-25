#!/usr/bin/env node
// =====================================================================
// DATABASE SEEDER
// =====================================================================
// Runs database/seed.sql to insert default settings and the global chat
// channel. Safe to run multiple times (seed.sql uses ON CONFLICT DO NOTHING).
//
// Usage:
//   npm run db:migrate   # make sure tables exist first
//   npm run db:seed
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SEED_FILE = path.join(__dirname, 'seed.sql');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await client.connect();
  try {
    const sql = fs.readFileSync(SEED_FILE, 'utf-8');
    // eslint-disable-next-line no-console
    console.log('Running seed data...');
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
