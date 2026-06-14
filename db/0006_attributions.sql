-- Links a story to an existing story it resembles.
--   inspired_by : author chose to credit the earlier story
--   similar     : author published despite the match; shown as "similar stories"

CREATE TABLE IF NOT EXISTS attributions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  related_story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('inspired_by', 'similar')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, related_story_id, kind)
);

CREATE INDEX IF NOT EXISTS attributions_story_idx ON attributions (story_id);
