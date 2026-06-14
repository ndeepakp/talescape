-- Reading progress + reader bookmarks.
--
--   reading_progress — the last chapter a reader opened in a story, so the home
--   page can offer "continue from there". One row per (reader, story).
--
--   bookmarks — reader-created marks. A reader selects a word/phrase in a
--   chapter; we store the quoted text so we can scroll to and highlight it next
--   time. Many per (reader, story, chapter).

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_index int NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
CREATE INDEX IF NOT EXISTS reading_progress_recent_idx
  ON reading_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_index int NOT NULL,
  quote         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookmarks_user_story_idx
  ON bookmarks (user_id, story_id);
