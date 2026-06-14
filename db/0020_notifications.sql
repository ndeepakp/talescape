-- A unified notifications feed. Every notifiable event (a purchase, a new
-- follower, a comment, a new subscriber) writes one row here for the recipient.
-- The bell and /notifications page read from this single table.
--
--   user_id   — the recipient (who sees the notification)
--   kind      — purchase | follow | comment | subscribe
--   actor_id  — who triggered it (nullable if that user is later deleted)
--   story_id  — optional story context
--   data      — kind-specific extras (amount, units, whole, snippet, …)
--   seen      — read/unread state

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('purchase', 'follow', 'comment', 'subscribe')),
  actor_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  seen       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- Backfill existing purchase FYIs (previously derived from access_grants), one
-- per (story, buyer) group, preserving their read state.
INSERT INTO notifications (user_id, kind, actor_id, story_id, data, seen, created_at)
SELECT
  s.author_id,
  'purchase',
  ag.user_id,
  ag.story_id,
  jsonb_build_object(
    'units', COUNT(*) FILTER (WHERE ag.scope = 'chapter'),
    'total', COALESCE(SUM(ag.amount), 0),
    'whole', bool_or(ag.scope = 'whole')
  ),
  NOT bool_or(NOT ag.seen_by_author),
  MAX(ag.created_at)
FROM access_grants ag
JOIN stories s ON s.id = ag.story_id
GROUP BY s.author_id, ag.user_id, ag.story_id;
