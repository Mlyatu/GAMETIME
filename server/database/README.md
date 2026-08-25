# Database Schema Notes

Engine: **PostgreSQL 14+**.

```bash
createdb efootball_arena
psql -d efootball_arena -f schema.sql
psql -d efootball_arena -f seed.sql
```

For a database created before Step 9, also run the migration in
`migrations/001_add_uuid_columns.sql` (fresh installs via `schema.sql`
above already include these columns — the migration is only for
already-deployed databases).

## Entity relationship summary

```
users (1) ─── (1) player_profiles
users (1) ─── (*) teams              [as captain]
teams (1) ─── (*) team_members ─── (*) users

tournaments (1) ─── (*) tournament_participants ─── users / teams
tournaments (1) ─── (*) matches
tournament_participants (1) ─── (*) matches      [as home/away]
matches (1) ─── (*) results
tournaments (1) ─── (*) standings ─── tournament_participants (1:1 per tournament)

users (1) ─── (*) payments
users (1) ─── (*) verifications
users (1) ─── (*) notifications
users (1) ─── (*) media
users (1) ─── (*) audit_logs

chat_channels (1) ─── (*) chat_messages ─── users
```

## Key design decisions

- **`uuid` columns**: every publicly-referenceable table (users, teams,
  tournaments, matches, payments) has a native `UUID` column alongside
  its numeric `id` (a `BIGSERIAL`). APIs will expose the UUID, never the
  auto-increment `id` — this stops someone guessing `/api/users/2` →
  `/api/users/3` to enumerate accounts. The UUID is generated app-side
  (Node's `uuid` package) at insert time, not by the database.

- **Enums as Postgres types, not inline strings**: MySQL lets you write
  `ENUM(...)` inline on a column; Postgres requires declaring the enum
  once with `CREATE TYPE` and reusing it. All 14 enum types (roles,
  statuses, formats, etc.) are declared at the top of `schema.sql`
  before any table uses them.

- **`updated_at` auto-refresh via trigger**: Postgres has no
  `ON UPDATE CURRENT_TIMESTAMP` shorthand like MySQL. Instead,
  `schema.sql` defines one shared `trigger_set_updated_at()` function
  and attaches it as a `BEFORE UPDATE` trigger to every table that has
  an `updated_at` column.

- **`CHECK` constraints replace `UNSIGNED`**: Postgres has no unsigned
  integer type, so columns that should never go negative (scores,
  counts, money amounts) use `CHECK (col >= 0)` instead.

- **`users` vs `player_profiles`**: authentication (email, password,
  role) lives in `users`. eFootball-specific data (gamer tag, platform,
  win/loss stats) lives in `player_profiles`. Admins and moderators
  never need those columns, so splitting keeps `users` lean.

- **`tournament_participants` as a middle table**: matches reference
  *participants*, not `users`/`teams` directly. This lets one table
  handle both solo and team tournaments, and lets us store per-tournament
  data (seed number, group label) without cluttering `users` or `teams`.

- **`results` is separate from `matches`**: a match can receive multiple
  result submissions (player submits, admin rejects, player resubmits).
  `results` keeps the full history; `matches.home_score`/`away_score`
  only get written once a result is approved. This is also where the
  OCR fields live (`ocr_extracted_text`, `ocr_confidence`) since OCR
  runs on submitted screenshots, not the confirmed match record.

- **`standings` is a cache, not a source of truth**: it's recalculated
  by the backend whenever a match result is approved, so the leaderboard
  page can do a single indexed read instead of aggregating every match
  in a tournament on every request.

- **Soft deletes**: `users.deleted_at` and `chat_messages.is_deleted`
  allow "removing" a record without breaking foreign-key history
  (e.g. a banned user's match history should still show correctly).

- **`audit_logs.metadata` is `JSONB`**: different actions need different
  extra context (a payment approval logs the amount; a ban logs the
  reason) — a flexible JSONB column avoids a wide table with mostly-NULL
  columns for every possible action type. `JSONB` (binary, indexable)
  is used over plain `JSON` since Postgres stores and queries it more
  efficiently.

## Still to add in later steps

- Indexes will be revisited once query patterns are known from the
  actual controllers (Step 5+).
- A `migrations/` folder with incremental migration files will replace
  this single `schema.sql` once the schema needs to evolve after
  initial deployment — running raw `schema.sql` again is only safe for
  first-time setup.
