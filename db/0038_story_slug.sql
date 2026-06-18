-- Human-readable URL slugs for stories (replaces raw UUIDs in story URLs).
-- The app resolves a route param as either a slug or a legacy UUID and redirects
-- UUID hits to the canonical slug URL, so old links keep working.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: slugify the title, deduping collisions within this batch by
-- appending -2, -3, … in creation order. Titles with no usable characters
-- fall back to "story".
WITH base AS (
  SELECT
    id,
    created_at,
    COALESCE(
      NULLIF(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), ''),
      'story'
    ) AS b
  FROM stories
  WHERE slug IS NULL
),
ranked AS (
  SELECT
    id,
    b,
    row_number() OVER (PARTITION BY b ORDER BY created_at, id) AS rn
  FROM base
)
UPDATE stories st
SET slug = r.b || CASE WHEN r.rn > 1 THEN '-' || r.rn ELSE '' END
FROM ranked r
WHERE st.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS stories_slug_key ON stories (slug);
