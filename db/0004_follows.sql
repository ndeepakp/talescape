-- Who follows whom. One row per (follower -> following) pair.

CREATE TABLE IF NOT EXISTS follows (
  follower_id  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id);
