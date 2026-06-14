-- Turns chapter access into a (mock) marketplace.
--
--   * stories.offered_durations — which access windows the author offers for
--     this story, e.g. {'1d','always'}. A reader picks one when buying.
--   * stories.whole_prices — price of the whole-story bundle per offered
--     duration, e.g. {"1d": 200, "always": 1000}. Empty = no whole-story bundle.
--   * each chapter object in stories.chapters now also carries a `prices` map of
--     duration -> price (per-chapter purchase), e.g. {"1d": 50}. Empty = that
--     chapter isn't sold individually.
--   Prices are integers in a single mock currency unit; 0 means free.
--
--   * access_grants — what a reader has bought. One row per purchased unit:
--     a whole-story bundle (scope 'whole') or a single chapter (scope
--     'chapter', chapter_index set). Access lasts until expires_at (NULL =
--     forever). Replaces the old interest/approval table.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS offered_durations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS whole_prices jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS access_grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id       uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scope          text NOT NULL CHECK (scope IN ('whole', 'chapter')),
  chapter_index  int,
  duration       text NOT NULL CHECK (duration IN ('1h', '1d', '1w', '1y', 'always')),
  amount         integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  seen_by_author boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS access_grants_story_idx ON access_grants (story_id);
CREATE INDEX IF NOT EXISTS access_grants_user_idx ON access_grants (user_id);

-- The interest/approval model is superseded by purchases.
DROP TABLE IF EXISTS story_interests;
