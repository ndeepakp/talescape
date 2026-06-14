-- Adds time-limited access grants and reader-side notifications.
--
--   * stories.access_duration — for a PRIVATE story, how long an approved
--     reader keeps access, measured from the moment the author approves them.
--     'always' means it never expires.
--   * story_interests.approved_at / expires_at — stamped when the author
--     approves a reader. expires_at NULL = never expires.
--   * story_interests.seen_by_reader — false right after approval so the reader
--     gets a "you've been approved" notification; set true once they've seen it.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS access_duration text NOT NULL DEFAULT 'always';

ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_access_duration_chk;
ALTER TABLE stories
  ADD CONSTRAINT stories_access_duration_chk
  CHECK (access_duration IN ('always', '1h', '1d', '1w', '1y'));

ALTER TABLE story_interests
  ADD COLUMN IF NOT EXISTS approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS seen_by_reader boolean NOT NULL DEFAULT true;
