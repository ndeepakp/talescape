-- Resolved @mentions on a post (who was tagged). Lets us power the "Mentioned"
-- filter precisely (by user id, not fragile text matching) and clean up.
CREATE TABLE IF NOT EXISTS post_mentions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS post_mentions_user_idx ON post_mentions (user_id);
