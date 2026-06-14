-- Two additions:
--   1. stories.status — lets an author keep a story as a private "draft" before
--      publishing it. Drafts never appear in the feed, search, genre pages or on
--      another reader's view of the author's profile; only the author sees them.
--   2. user.about — a longer, free-form "About" blurb on a writer's profile
--      (their motto, goals, hobbies, what they do day to day). Separate from the
--      short one-line bio.

-- 1. Story publish status. Existing rows are all already public, so default and
--    backfill them to 'published'.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

-- Guard against unexpected values.
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_chk;
ALTER TABLE stories
  ADD CONSTRAINT stories_status_chk CHECK (status IN ('draft', 'published'));

-- Fast "published only" filtering for the public lists.
CREATE INDEX IF NOT EXISTS stories_status_idx ON stories (status);

-- 2. Free-form profile "About" text.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS about text;
