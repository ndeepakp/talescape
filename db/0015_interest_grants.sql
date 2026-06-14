-- Turns "express interest" into an access-grant flow, and lets an author make a
-- story's chapters public.
--
--   * story_interests.status — a reader's interest starts as 'pending'. The
--     author sees pending interests as notifications and can 'approved' them,
--     which grants that reader access to the (otherwise private) chapters.
--   * stories.chapters_public — when true, the chapters are readable by anyone,
--     so no interest/approval is needed at all.

-- 1. Interest status. Existing rows become 'pending' so authors are prompted to
--    approve readers who already showed interest.
ALTER TABLE story_interests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE story_interests DROP CONSTRAINT IF EXISTS story_interests_status_chk;
ALTER TABLE story_interests
  ADD CONSTRAINT story_interests_status_chk CHECK (status IN ('pending', 'approved'));

-- 2. Whether a story's chapters are open to everyone.
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS chapters_public boolean NOT NULL DEFAULT false;
