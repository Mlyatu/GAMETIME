-- =====================================================================
-- MIGRATION 002: Make chat channel (name, type) unique
-- =====================================================================
-- This lets seed.sql safely insert the global lobby with
-- ON CONFLICT DO NOTHING so the seed script is idempotent.
-- =====================================================================

ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_name_type_unique UNIQUE (name, type);
