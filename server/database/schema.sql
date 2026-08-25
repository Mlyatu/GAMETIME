-- =====================================================================
-- EFOOTBALL ARENA — DATABASE SCHEMA (PostgreSQL 14+)
-- =====================================================================
-- Run against an empty database:
--   createdb efootball_arena
--   psql -d efootball_arena -f schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared trigger function: Postgres has no "ON UPDATE CURRENT_TIMESTAMP"
-- like MySQL, so every table with an `updated_at` column uses this
-- trigger to keep it current automatically on every UPDATE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Enum types. Postgres enums are declared once, then reused as a
-- column type — this also makes invalid values impossible at the DB
-- level, same intent as MySQL's inline ENUM(...).
-- ---------------------------------------------------------------------
CREATE TYPE user_role            AS ENUM ('player', 'moderator', 'admin');
CREATE TYPE user_status          AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE auth_token_type      AS ENUM ('email_verification', 'password_reset', 'refresh');
CREATE TYPE player_platform      AS ENUM ('mobile', 'ps', 'xbox', 'pc');
CREATE TYPE tournament_format    AS ENUM ('league', 'knockout', 'round_robin', 'swiss', 'groups');
CREATE TYPE tournament_status    AS ENUM ('draft', 'registration_open', 'ongoing', 'completed', 'cancelled');
CREATE TYPE participant_status   AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
CREATE TYPE match_status         AS ENUM ('scheduled', 'ongoing', 'pending_verification', 'completed', 'disputed', 'walkover');
CREATE TYPE verification_state   AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_method       AS ENUM ('mpesa', 'airtel_money', 'tigo_pesa', 'halopesa', 'bank');
CREATE TYPE payment_status       AS ENUM ('pending', 'approved', 'rejected', 'refunded');
CREATE TYPE verification_type    AS ENUM ('identity', 'payment_method', 'age');
CREATE TYPE media_type           AS ENUM ('poster', 'video', 'banner', 'background', 'logo', 'gallery');
CREATE TYPE chat_channel_type    AS ENUM ('global', 'tournament', 'direct');

-- ---------------------------------------------------------------------
-- 1. USERS
-- Base identity table. Both players and admins are "users" — the
-- `role` column decides what they can do, avoiding duplicate auth
-- logic across separate Player/Admin tables.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    uuid                UUID            NOT NULL UNIQUE,   -- public-facing ID, generated app-side (never expose the serial id)
    full_name           VARCHAR(100)    NOT NULL,
    username            VARCHAR(50)     NOT NULL UNIQUE,
    email               VARCHAR(150)    NOT NULL UNIQUE,
    phone               VARCHAR(20),
    password_hash       VARCHAR(255)    NOT NULL,          -- bcrypt hash, never plaintext
    role                user_role       NOT NULL DEFAULT 'player',
    avatar_url          VARCHAR(255),
    is_email_verified   BOOLEAN         NOT NULL DEFAULT FALSE,
    two_factor_enabled  BOOLEAN         NOT NULL DEFAULT FALSE,
    two_factor_secret   VARCHAR(255),                      -- encrypted TOTP secret, ready for 2FA
    status              user_status     NOT NULL DEFAULT 'active',
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ                          -- soft delete
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------
-- 2. AUTH TOKENS (email verification / password reset / refresh)
-- ---------------------------------------------------------------------
CREATE TABLE auth_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255)    NOT NULL,      -- store hash of token, never the raw token
    type        auth_token_type NOT NULL,
    expires_at  TIMESTAMPTZ     NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tokens_user_type ON auth_tokens(user_id, type);

-- ---------------------------------------------------------------------
-- 3. PLAYER PROFILES
-- Extends `users` with eFootball-specific data, so `users` stays lean
-- for admin/moderator rows that don't need any of this.
-- ---------------------------------------------------------------------
CREATE TABLE player_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    gamer_tag       VARCHAR(50)     NOT NULL,          -- in-game / PSN / Konami ID
    platform        player_platform NOT NULL DEFAULT 'mobile',
    country         VARCHAR(60),
    bio             TEXT,
    total_matches   INTEGER         NOT NULL DEFAULT 0 CHECK (total_matches >= 0),
    wins            INTEGER         NOT NULL DEFAULT 0 CHECK (wins >= 0),
    draws           INTEGER         NOT NULL DEFAULT 0 CHECK (draws >= 0),
    losses          INTEGER         NOT NULL DEFAULT 0 CHECK (losses >= 0),
    goals_scored    INTEGER         NOT NULL DEFAULT 0 CHECK (goals_scored >= 0),
    goals_conceded  INTEGER         NOT NULL DEFAULT 0 CHECK (goals_conceded >= 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON player_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------
-- 4. TEAMS
-- ---------------------------------------------------------------------
CREATE TABLE teams (
    id          BIGSERIAL PRIMARY KEY,
    uuid        UUID            NOT NULL UNIQUE,
    name        VARCHAR(100)    NOT NULL,
    tag         VARCHAR(10),                    -- short team tag e.g. "ARN"
    logo_url    VARCHAR(255),
    captain_id  BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_teams_captain ON teams(captain_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Junction table: which players belong to which team
CREATE TABLE team_members (
    id          BIGSERIAL PRIMARY KEY,
    team_id     BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

-- ---------------------------------------------------------------------
-- 5. TOURNAMENTS
-- ---------------------------------------------------------------------
CREATE TABLE tournaments (
    id                      BIGSERIAL         PRIMARY KEY,
    uuid                    UUID              NOT NULL UNIQUE,
    name                    VARCHAR(150)      NOT NULL,
    description             TEXT,
    banner_url              VARCHAR(255),
    format                  tournament_format NOT NULL,
    max_participants        INTEGER           NOT NULL DEFAULT 32 CHECK (max_participants > 0),
    entry_fee               NUMERIC(12,2)     NOT NULL DEFAULT 0.00 CHECK (entry_fee >= 0),
    prize_pool              NUMERIC(12,2)     NOT NULL DEFAULT 0.00 CHECK (prize_pool >= 0),
    status                  tournament_status NOT NULL DEFAULT 'draft',
    registration_deadline   TIMESTAMPTZ,
    start_date              TIMESTAMPTZ,
    end_date                TIMESTAMPTZ,
    created_by              BIGINT           NOT NULL REFERENCES users(id),  -- admin/moderator who created it
    created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Junction: which players/teams entered which tournament
CREATE TABLE tournament_participants (
    id              BIGSERIAL            PRIMARY KEY,
    uuid            UUID                 NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    tournament_id   BIGINT               NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id         BIGINT               REFERENCES users(id) ON DELETE CASCADE,   -- solo entrant
    team_id         BIGINT               REFERENCES teams(id) ON DELETE CASCADE,   -- team entrant
    seed            INTEGER,                                                       -- bracket seeding position
    group_label     VARCHAR(10),                                                   -- e.g. "Group A"
    status          participant_status   NOT NULL DEFAULT 'pending',
    joined_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_participant_entrant CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)
    )
);
CREATE INDEX idx_participants_tournament ON tournament_participants(tournament_id);

-- ---------------------------------------------------------------------
-- 6. MATCHES (fixtures)
-- ---------------------------------------------------------------------
CREATE TABLE matches (
    id                      BIGSERIAL     PRIMARY KEY,
    uuid                    UUID          NOT NULL UNIQUE,
    tournament_id           BIGINT        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round                   VARCHAR(50),                     -- e.g. "Round 1", "Quarter Final", "Final"
    home_participant_id     BIGINT        REFERENCES tournament_participants(id) ON DELETE SET NULL,
    away_participant_id     BIGINT        REFERENCES tournament_participants(id) ON DELETE SET NULL,
    scheduled_at            TIMESTAMPTZ,
    home_score              INTEGER       CHECK (home_score >= 0),
    away_score              INTEGER       CHECK (away_score >= 0),
    status                  match_status  NOT NULL DEFAULT 'scheduled',
    winner_participant_id   BIGINT        REFERENCES tournament_participants(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------
-- 7. RESULTS (submitted evidence per match, before/after verification)
-- Kept separate from `matches` so every submission is preserved as an
-- audit trail (submit → admin rejects → resubmit), while `matches`
-- only holds the one confirmed score.
-- ---------------------------------------------------------------------
CREATE TABLE results (
    id                      BIGSERIAL           PRIMARY KEY,
    uuid                    UUID                NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    match_id                BIGINT              NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    submitted_by            BIGINT              NOT NULL REFERENCES users(id),
    claimed_home_score      INTEGER             NOT NULL CHECK (claimed_home_score >= 0),
    claimed_away_score      INTEGER             NOT NULL CHECK (claimed_away_score >= 0),
    screenshot_url          VARCHAR(255),                     -- proof screenshot
    ocr_extracted_text      TEXT,                             -- raw Tesseract.js output
    ocr_confidence          NUMERIC(5,2),
    verification_status     verification_state NOT NULL DEFAULT 'pending',
    verified_by             BIGINT              REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_results_match ON results(match_id);

-- ---------------------------------------------------------------------
-- 8. STANDINGS (auto-calculated league table per tournament)
-- Recomputed by the backend whenever a match is verified — stored so
-- leaderboard reads are a fast indexed lookup, not a live aggregation
-- over every match in the tournament.
-- ---------------------------------------------------------------------
CREATE TABLE standings (
    id                  BIGSERIAL   PRIMARY KEY,
    tournament_id       BIGINT      NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    participant_id      BIGINT      NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    played              INTEGER     NOT NULL DEFAULT 0 CHECK (played >= 0),
    won                 INTEGER     NOT NULL DEFAULT 0 CHECK (won >= 0),
    drawn               INTEGER     NOT NULL DEFAULT 0 CHECK (drawn >= 0),
    lost                INTEGER     NOT NULL DEFAULT 0 CHECK (lost >= 0),
    goals_for           INTEGER     NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
    goals_against       INTEGER     NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
    goal_difference     INTEGER     NOT NULL DEFAULT 0,
    points              INTEGER     NOT NULL DEFAULT 0 CHECK (points >= 0),
    rank                INTEGER,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, participant_id)
);
CREATE INDEX idx_standings_rank ON standings(tournament_id, rank);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON standings
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------
-- 9. ANNOUNCEMENTS
-- ---------------------------------------------------------------------
CREATE TABLE announcements (
    id              BIGSERIAL       PRIMARY KEY,
    title           VARCHAR(200)    NOT NULL,
    body            TEXT            NOT NULL,
    tournament_id   BIGINT          REFERENCES tournaments(id) ON DELETE CASCADE,  -- NULL = global
    created_by      BIGINT          NOT NULL REFERENCES users(id),
    is_pinned       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 10. CHAT (global + tournament-scoped live chat, backed by Socket.io)
-- ---------------------------------------------------------------------
CREATE TABLE chat_channels (
    id              BIGSERIAL         PRIMARY KEY,
    name            VARCHAR(100)      NOT NULL,
    type            chat_channel_type NOT NULL DEFAULT 'global',
    tournament_id   BIGINT            REFERENCES tournaments(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id          BIGSERIAL   PRIMARY KEY,
    channel_id  BIGINT      NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id   BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT        NOT NULL,
    is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,   -- soft delete for moderation
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_channel_time ON chat_messages(channel_id, created_at);

-- ---------------------------------------------------------------------
-- 11. NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50)  NOT NULL,      -- e.g. 'match_scheduled', 'payment_approved'
    title       VARCHAR(150) NOT NULL,
    body        TEXT,
    link_url    VARCHAR(255),               -- deep link, e.g. /matches/123
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- ---------------------------------------------------------------------
-- 12. PAYMENTS
-- ---------------------------------------------------------------------
CREATE TABLE payments (
    id                      BIGSERIAL       PRIMARY KEY,
    uuid                    UUID            NOT NULL UNIQUE,
    user_id                 BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id           BIGINT          REFERENCES tournaments(id) ON DELETE SET NULL,  -- entry-fee payment; NULL for other types
    amount                  NUMERIC(12,2)   NOT NULL CHECK (amount >= 0),
    currency                VARCHAR(10)     NOT NULL DEFAULT 'TZS',
    method                  payment_method  NOT NULL,
    transaction_reference   VARCHAR(100),                     -- reference/txn ID from the provider
    proof_screenshot_url    VARCHAR(255),
    status                  payment_status  NOT NULL DEFAULT 'pending',
    reviewed_by             BIGINT          REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_status ON payments(status);

-- ---------------------------------------------------------------------
-- 13. VERIFICATIONS (generic identity/document checks — distinct from
-- match-result verification, e.g. KYC-style ID checks)
-- ---------------------------------------------------------------------
CREATE TABLE verifications (
    id              BIGSERIAL          PRIMARY KEY,
    user_id         BIGINT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            verification_type  NOT NULL,
    document_url    VARCHAR(255),
    status          verification_state NOT NULL DEFAULT 'pending',
    reviewed_by     BIGINT             REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 14. MEDIA (posters, banners, videos, galleries)
-- ---------------------------------------------------------------------
CREATE TABLE media (
    id              BIGSERIAL    PRIMARY KEY,
    uuid            UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    uploaded_by     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tournament_id   BIGINT       REFERENCES tournaments(id) ON DELETE CASCADE,
    type            media_type   NOT NULL,
    file_url        VARCHAR(255) NOT NULL,
    caption         VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 15. AUDIT LOGS (who did what, for accountability + security review)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       REFERENCES users(id) ON DELETE SET NULL,  -- NULL if action was by the system
    action      VARCHAR(100) NOT NULL,      -- e.g. 'payment.approved', 'user.banned'
    entity_type VARCHAR(50),                -- e.g. 'payment', 'match'
    entity_id   BIGINT,
    ip_address  VARCHAR(45),
    metadata    JSONB,                      -- flexible extra detail per action
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 16. SETTINGS (key-value app configuration)
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    id              SERIAL       PRIMARY KEY,
    setting_key     VARCHAR(100) NOT NULL UNIQUE,
    setting_value   TEXT,
    description     VARCHAR(255),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
