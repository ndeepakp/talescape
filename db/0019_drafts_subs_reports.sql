-- Three additions:
--   1. stories.draft_expires_at — a draft is kept for 7 days from its last save;
--      after that it's expired (cleaned up lazily). NULL for published stories.
--   2. user.subscription_price + subscriptions — an author may offer a paid
--      subscription (their own price). An active subscription unlocks ALL of
--      that author's private chapters for the subscriber (additive: one-off
--      buying still works). Fixed 30-day term (mock payments).
--   3. user_reports — readers can report a user as not genuine; reports enter a
--      mock "under review" due-diligence queue.

-- 1. Draft expiry.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz;

-- 2. Subscriptions.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS subscription_price integer; -- NULL/absent = not offered

CREATE TABLE IF NOT EXISTS subscriptions (
  subscriber_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  author_id     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  amount        integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  PRIMARY KEY (subscriber_id, author_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_author_idx ON subscriptions (author_id);

-- 3. User reports (mock due-diligence).
CREATE TABLE IF NOT EXISTS user_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reported_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'under_review'
              CHECK (status IN ('under_review', 'dismissed', 'actioned')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, reported_id)
);
CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON user_reports (reported_id);
