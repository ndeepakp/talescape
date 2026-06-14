-- More notification kinds: reactions (like/dislike), a subscription about to
-- expire, and a new chapter added to a story.
--
--   subscriptions.expiry_notified — set once we've warned the subscriber their
--   subscription is ending, so we don't nag repeatedly. Reset on renewal.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS expiry_notified boolean NOT NULL DEFAULT false;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'purchase', 'follow', 'comment', 'subscribe',
    'reaction', 'sub_expiring', 'new_chapter'
  ));
