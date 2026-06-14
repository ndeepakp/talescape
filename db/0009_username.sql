-- Add a unique @handle (stored bare, shown with a leading "$") and a bio.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio text;

-- Backfill existing accounts: derive a handle from the display name by keeping
-- only letters/digits/underscores. If that collides or is too short, fall back
-- to a slice of the user id so every row ends up unique.
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM "user" WHERE username IS NULL ORDER BY "createdAt" LOOP
    base := regexp_replace(coalesce(r.name, ''), '[^A-Za-z0-9_]', '', 'g');
    IF length(base) < 3 THEN
      base := 'user' || substr(r.id, 1, 6);
    END IF;
    base := substr(base, 1, 20);
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "user" WHERE lower(username) = lower(candidate)) LOOP
      n := n + 1;
      candidate := substr(base, 1, 18) || n::text;
    END LOOP;
    UPDATE "user" SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "user" ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_username_lower_idx ON "user" (lower(username));
CREATE INDEX IF NOT EXISTS user_username_trgm_idx ON "user" USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS user_name_trgm_idx ON "user" USING gin (name gin_trgm_ops);
