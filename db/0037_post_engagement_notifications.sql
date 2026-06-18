-- Allow notification kinds for post engagement and story reviews:
--   'post_like'    — someone liked your post
--   'post_comment' — someone commented on your post
--   'review'       — a reader left a star review on your story
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'purchase', 'follow', 'comment', 'subscribe',
    'reaction', 'sub_expiring', 'new_chapter', 'mention', 'story_mention',
    'post_like', 'post_comment', 'review'
  ));
