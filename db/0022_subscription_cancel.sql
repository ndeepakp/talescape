-- Unsubscribing now cancels future renewal but keeps access until the paid
-- period ends, rather than revoking immediately. `cancelled` tracks that state.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;
