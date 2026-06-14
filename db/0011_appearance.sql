-- Per-account appearance preferences, synced across devices.
-- Defaults reproduce the current look exactly (light theme, graphite accent,
-- plain background) so existing users see no change until they opt in.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT 'graphite';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS background_preset text NOT NULL DEFAULT 'plain';
