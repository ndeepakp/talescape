-- Stories, genres, and the link between them.

CREATE TABLE IF NOT EXISTS genres (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  slug  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS stories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  excerpt    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stories_created_at_idx ON stories (created_at DESC);
CREATE INDEX IF NOT EXISTS stories_author_idx ON stories (author_id);

CREATE TABLE IF NOT EXISTS story_genres (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  genre_id integer NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, genre_id)
);

INSERT INTO genres (name, slug) VALUES
  ('Fantasy', 'fantasy'),
  ('Science Fiction', 'science-fiction'),
  ('Romance', 'romance'),
  ('Mystery', 'mystery'),
  ('Thriller', 'thriller'),
  ('Horror', 'horror'),
  ('Historical', 'historical'),
  ('Literary', 'literary'),
  ('Adventure', 'adventure'),
  ('Young Adult', 'young-adult'),
  ('Poetry', 'poetry'),
  ('Non-fiction', 'non-fiction')
ON CONFLICT (slug) DO NOTHING;
