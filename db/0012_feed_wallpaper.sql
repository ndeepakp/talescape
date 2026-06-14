-- Optional custom wallpaper image for the feed page only. Stored as a URL path
-- (e.g. /uploads/feed-wallpapers/<file>) pointing at an uploaded image.
-- NULL means "no wallpaper" — the normal page background is used.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS feed_wallpaper text;
