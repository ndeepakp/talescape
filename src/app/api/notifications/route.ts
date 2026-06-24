import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession, withErrors } from "@/lib/http";
import { RENEWAL_DISCOUNT_PCT } from "@/lib/pricing";

// The current user's notifications (purchases, follows, comments, subscribes),
// read AND unread. Returns the most recent few for the bell dropdown plus
// total / unread counts.
export const GET = withErrors(async () => {
  const session = await requireSession();
  const me = session.user.id;

  // Lazily raise "your subscription is expiring" notifications for the viewer:
  // any active subscription ending within 3 days that we haven't warned about
  // yet. The flag prevents repeat nags (and is reset when they renew).
  await sql`
    WITH expiring AS (
      UPDATE subscriptions
      SET expiry_notified = true
      WHERE subscriber_id = ${me}
        AND expires_at > now()
        AND expires_at <= now() + interval '3 days'
        AND expiry_notified = false
      RETURNING author_id, amount,
        CEIL(EXTRACT(EPOCH FROM (expires_at - now())) / 86400)::int AS days_left
    )
    INSERT INTO notifications (user_id, kind, actor_id, data)
    SELECT ${me}, 'sub_expiring', e.author_id,
           jsonb_build_object('amount', e.amount, 'days_left', e.days_left)
    FROM expiring e
  `;

  // Same for per-story/chapter access grants about to lapse: nudge the reader to
  // renew (at a discount). Deduped to one notification per story (soonest expiry).
  await sql`
    WITH expiring AS (
      UPDATE access_grants
      SET expiry_notified = true
      WHERE user_id = ${me}
        AND expires_at IS NOT NULL
        AND expires_at > now()
        AND expires_at <= now() + interval '3 days'
        AND expiry_notified = false
      RETURNING story_id,
        CEIL(EXTRACT(EPOCH FROM (expires_at - now())) / 86400)::int AS days_left
    )
    INSERT INTO notifications (user_id, kind, story_id, data)
    SELECT ${me}, 'grant_expiring', e.story_id,
           jsonb_build_object('days_left', min(e.days_left), 'discount', ${RENEWAL_DISCOUNT_PCT}::int)
    FROM expiring e
    GROUP BY e.story_id
  `;

  const items = await sql`
    SELECT
      n.id, n.kind, n.actor_id, a.name AS actor_name, a.username AS actor_handle,
      n.story_id, s.title AS story_title, n.data, n.seen, n.created_at
    FROM notifications n
    LEFT JOIN "user" a ON a.id = n.actor_id
    LEFT JOIN stories s ON s.id = n.story_id
    WHERE n.user_id = ${me}
    ORDER BY n.created_at DESC
    LIMIT 8
  `;

  const [counts] = await sql<{ total: number; unread: number }[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE NOT seen)::int AS unread
    FROM notifications WHERE user_id = ${me}
  `;

  return NextResponse.json({
    items,
    unread: counts?.unread ?? 0,
    total: counts?.total ?? 0,
  });
});
