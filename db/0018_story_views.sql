-- Records story views so authors can see view analytics on their profile.
-- One row per (story, viewer, day) — refreshes/re-opens on the same day count
-- once, so "views" means distinct daily viewers. The author's own views are not
-- recorded (enforced in the API).

CREATE TABLE IF NOT EXISTS story_views (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day        date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id, day)
);

CREATE INDEX IF NOT EXISTS story_views_story_idx ON story_views (story_id);
CREATE INDEX IF NOT EXISTS story_views_day_idx ON story_views (day);
