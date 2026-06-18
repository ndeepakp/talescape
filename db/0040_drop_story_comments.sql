-- Drop the per-story comments feature. Story discussion now lives in "Posts
-- about this story" (posts + post_comments), so the original comments table
-- (added in 0003_comments.sql) is unused. The index is dropped with the table.
DROP TABLE IF EXISTS comments;
