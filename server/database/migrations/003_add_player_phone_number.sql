ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(16);
