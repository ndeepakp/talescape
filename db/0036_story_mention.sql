-- Allow the 'story_mention' notification kind: a post mentioned someone's story,
-- so we notify that story's author.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'purchase', 'follow', 'comment', 'subscribe',
    'reaction', 'sub_expiring', 'new_chapter', 'mention', 'story_mention'
  ));
