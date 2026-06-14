-- Reader collections — like playlists for stories. A reader groups stories into
-- named collections; later these can be shared externally (future).

CREATE TABLE IF NOT EXISTS collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collections_user_idx ON collections (user_id);

CREATE TABLE IF NOT EXISTS collection_stories (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, story_id)
);
