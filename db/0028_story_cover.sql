-- Optional cover image for a story (like a novel cover). URL path of an uploaded
-- image, or NULL when the author hasn't set one.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS cover_url text;
