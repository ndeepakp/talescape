-- Switch view de-duplication from once-per-day to once-per-hour. Previously the
-- primary key (story_id, viewer_id, day) capped a reader at one view per day.
-- Now we allow multiple rows per (reader, story) and the view API inserts a new
-- one only if the reader hasn't viewed in the last hour. View count stays
-- COUNT(*) of rows (author's own views are still never recorded).
ALTER TABLE story_views DROP CONSTRAINT IF EXISTS story_views_pkey;
ALTER TABLE story_views ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE story_views ADD PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS story_views_dedupe_idx
  ON story_views (story_id, viewer_id, created_at DESC);
