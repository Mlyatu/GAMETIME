#!/usr/bin/env node
// =====================================================================
// CLEAN TEST USERS
// =====================================================================
// Permanently removes every NON-ADMIN user (and their profiles, tokens,
// notifications, payments, media, team memberships, participations, chat
// messages) so the system is a clean slate for real use. Admins are kept.
//
// This is DESTRUCTIVE and irreversible — it hard-deletes rows from the
// database, it does not soft-delete. Run it only when you're sure.
//
// Usage:
//   node database/clean-users.js            # delete all non-admin users
//   node database/clean-users.js --dry-run  # just show what would go
// =====================================================================

require('dotenv').config();
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

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
    const admins = await client.query("SELECT id, username FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY id");
    const targets = await client.query("SELECT id, uuid, username, email, role FROM users WHERE role <> 'admin' AND deleted_at IS NULL ORDER BY id");

    // eslint-disable-next-line no-console
    console.log(`Admins that will be KEPT: ${admins.rows.map((a) => a.username).join(', ') || '(none)'}`);
    // eslint-disable-next-line no-console
    console.log(`Non-admin users that will be DELETED (${targets.rowCount}):`);
    targets.rows.forEach((u) => console.log(`   - ${u.username} <${u.email}> (${u.role})`));

    if (targets.rowCount === 0) {
      // eslint-disable-next-line no-console
      console.log('\nNothing to clean — no non-admin users found.');
      return;
    }

    if (DRY_RUN) {
      // eslint-disable-next-line no-console
      console.log('\n--dry-run: no changes made.');
      return;
    }

    // Reassign NOT NULL ownership FKs (tournaments/announcements/results)
    // to the first admin so historical records survive, then delete.
    const adminId = admins.rows[0] ? admins.rows[0].id : null;
    if (!adminId) {
      // eslint-disable-next-line no-console
      console.error('\nNo admin exists to reassign records to. Create an admin first (npm run db:create-admin).');
      process.exitCode = 1;
      return;
    }

    await client.query('BEGIN');
    const ids = targets.rows.map((r) => r.id);

    await client.query('UPDATE tournaments SET created_by = $1 WHERE created_by = ANY($2::bigint[])', [adminId, ids]);
    await client.query('UPDATE announcements SET created_by = $1 WHERE created_by = ANY($2::bigint[])', [adminId, ids]);
    await client.query('UPDATE results SET submitted_by = $1 WHERE submitted_by = ANY($2::bigint[])', [adminId, ids]);
    await client.query('UPDATE results SET verified_by = NULL WHERE verified_by = ANY($1::bigint[])', [ids]);
    await client.query('UPDATE payments SET reviewed_by = NULL WHERE reviewed_by = ANY($1::bigint[])', [ids]);
    await client.query('UPDATE verifications SET reviewed_by = NULL WHERE reviewed_by = ANY($1::bigint[])', [ids]);
    await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = ANY($1::bigint[])', [ids]);

    const del = await client.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log(`\nDeleted ${del.rowCount} user(s). Admins were kept.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // eslint-disable-next-line no-console
    console.error('Cleanup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
