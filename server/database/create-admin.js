#!/usr/bin/env node
// =====================================================================
// CREATE DEFAULT ADMIN
// =====================================================================
// Creates an admin user (and linked player_profile) if one does not
// already exist for the given email. Prompts for credentials so no
// default password is committed to source control.
//
// Usage:
//   npm run db:migrate
//   node database/create-admin.js
// =====================================================================

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, fallback = '') {
  return new Promise((resolve) => {
    const prompt = fallback ? `${question} [${fallback}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || fallback);
    });
  });
}

async function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(`${question}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    stdin.on('data', (ch) => {
      const char = ch.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\b' || char === '\x7f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        password += char;
        stdout.write('*');
      }
    });
  });
}

async function main() {
  await client.connect();

  try {
    const existing = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rowCount > 0) {
      // eslint-disable-next-line no-console
      console.log('An admin user already exists. Use the app to create additional admins.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Create the first admin account\n');

    const email = await ask('Admin email');
    const username = await ask('Admin username');
    const fullName = await ask('Full name', username);
    const gamerTag = await ask('Gamer tag', username);
    const password = await askHidden('Password');
    const confirm = await askHidden('Confirm password');

    if (!email || !username || !password) {
      // eslint-disable-next-line no-console
      console.error('Email, username, and password are required.');
      process.exitCode = 1;
      return;
    }

    if (password !== confirm) {
      // eslint-disable-next-line no-console
      console.error('Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    if (password.length < 8) {
      // eslint-disable-next-line no-console
      console.error('Password must be at least 8 characters.');
      process.exitCode = 1;
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const userUuid = uuidv4();

    const userResult = await client.query(
      `INSERT INTO users (uuid, full_name, username, email, password_hash, role, is_email_verified, status)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE, 'active')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [userUuid, fullName, username, email, hash]
    );

    if (userResult.rowCount === 0) {
      // eslint-disable-next-line no-console
      console.error('A user with that email already exists.');
      process.exitCode = 1;
      return;
    }

    const userId = userResult.rows[0].id;
    await client.query(
      `INSERT INTO player_profiles (user_id, gamer_tag, platform, country, bio)
       VALUES ($1, $2, 'mobile', NULL, NULL)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, gamerTag]
    );

    // eslint-disable-next-line no-console
    console.log(`\nAdmin user '${username}' created successfully. You can now log in at /pages/login.html`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create admin:', err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await client.end();
  }
}

main();
