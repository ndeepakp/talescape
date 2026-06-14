-- One reaction per user per story: +1 = like, -1 = dislike.

CREATE TABLE IF NOT EXISTS reactions (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS reactions_story_idx ON reactions (story_id);
