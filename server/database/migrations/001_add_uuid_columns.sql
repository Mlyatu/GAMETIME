-- =====================================================================
-- MIGRATION 001: Add uuid to tournament_participants, media, and results
-- =====================================================================
-- The original schema.sql (Step 2) gave every publicly-referenceable
-- table a `uuid` column except these three — an oversight that surfaced
-- two different ways: `media`/`results` needed uuid once Step 9's API
-- had to expose them, and `tournament_participants` was silently relied
-- on by Step 6's match.model.js (`hp.uuid`, `ap.uuid`, `wp.uuid`) even
-- though the column never existed — a latent bug that only Step 9's
-- fuller integration test surfaced, since GET /api/match/:uuid was never
-- exercised in the Step 6 test.
--
-- Fresh installs don't need this file — schema.sql already includes
-- these columns directly. Run this only against a database created
-- before this migration existed.
--
--   psql -d efootball_arena -f database/migrations/001_add_uuid_columns.sql
--
-- gen_random_uuid() is built into PostgreSQL core since v13 — no
-- extension needed on the v14+ this project targets.
-- =====================================================================

ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
