-- A reader's preferred genres, chosen at sign-up. Drives the personalised feed.
CREATE TABLE IF NOT EXISTS user_genres (
  user_id  text    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  genre_id integer NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, genre_id)
);

CREATE INDEX IF NOT EXISTS user_genres_user_idx ON user_genres (user_id);
