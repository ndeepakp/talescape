-- Star reviews replace the old 👍/👎 reactions. A reader with access to a story
-- rates it 0.5–5 stars and optionally notes what they liked / didn't. One review
-- per (reader, story), editable. `pinned` lets the author feature a review.
CREATE TABLE IF NOT EXISTS reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  stars      numeric(2,1) NOT NULL CHECK (stars >= 0.5 AND stars <= 5.0),
  liked      text,
  disliked   text,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS reviews_story_idx ON reviews (story_id);
