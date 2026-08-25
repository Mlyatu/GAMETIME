-- =====================================================================
-- EFOOTBALL ARENA — SEED DATA
-- Run after schema.sql. Provides sane defaults so the app is usable
-- immediately after setup, without needing to hand-insert config rows.
-- Safe to run multiple times — all INSERTs use ON CONFLICT DO NOTHING.
-- =====================================================================

-- Default application settings (key/value config, editable later
-- from the Admin > Settings page instead of hard-coding in code).
INSERT INTO settings (setting_key, setting_value, description) VALUES
('site_name', 'EFootball Arena', 'Public name shown across the platform'),
('default_currency', 'TZS', 'Default currency for entry fees and payments'),
('registration_open', 'true', 'Global switch to allow new player registrations'),
('max_upload_size_mb', '10', 'Maximum allowed upload size for screenshots/media'),
('support_email', 'support@efootballarena.com', 'Contact email shown to players')
ON CONFLICT (setting_key) DO NOTHING;

-- Default chat channel (global lobby) — created once, referenced by
-- Socket.io as the default room every connected user joins.
INSERT INTO chat_channels (name, type) VALUES ('Global Lobby', 'global')
ON CONFLICT (name, type) DO NOTHING;

-- NOTE: A default admin account is intentionally NOT seeded with a
-- hard-coded password here. Create the first admin via the
-- `server/database/create-admin.js` script, which prompts for credentials
-- and hashes them with bcrypt.
