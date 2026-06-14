-- Evolve a "story" into a gated work: a public title + summary, plus private
-- chapters only the author can see until a reader's interest/bid unlocks them.
--
-- Data model notes:
--   * summary  — the public blurb shown in the feed/search and on the story page
--                to everyone (75–150 words, enforced in app code).
--   * chapters — JSON array of { title, body } objects, author-private. Shown
--                only to the author until the future bidding flow grants access.
--   * body     — kept as an internal, server-only concatenation of all chapter
--                text. It powers the embedding + lexical similarity ("originality")
--                checks and is NEVER selected for non-author viewers.
--   * excerpt  — legacy column, no longer read by the app. Left in place (now
--                nullable) so historical rows aren't disturbed.

-- 1. New columns. Add them nullable first so we can backfill existing rows.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS summary  text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS chapters jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. The old "excerpt" is no longer required for new stories.
ALTER TABLE stories ALTER COLUMN excerpt DROP NOT NULL;

-- 3. Backfill historical stories so nothing breaks:
--    - their old short excerpt becomes the public summary, and
--    - their full body becomes a single untitled "Chapter 1".
UPDATE stories
SET summary = COALESCE(summary, excerpt, '')
WHERE summary IS NULL;

UPDATE stories
SET chapters = jsonb_build_array(jsonb_build_object('title', NULL, 'body', body))
WHERE chapters = '[]'::jsonb
  AND body IS NOT NULL
  AND length(btrim(body)) > 0;

-- 4. Now that every row has a summary, require it going forward.
ALTER TABLE stories ALTER COLUMN summary SET NOT NULL;

-- 5. Readers expressing interest in a story's hidden chapters. This is the
--    foundation the future bidding flow will build on. One row per (story, user).
CREATE TABLE IF NOT EXISTS story_interests (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_interests_story_idx ON story_interests (story_id);
