import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { notify } from "@/lib/notify";

// A reader subscribes to an author. MOCK checkout: the price is taken from the
// author's profile (never trusted from the client), a 30-day subscription is
// recorded (or extended), and the subscriber immediately gets access to all of
// that author's private chapters.
export const POST = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const session = await requireSession();
  const me = session.user.id;

  if (id === me) throw new ApiError(400, "You can't subscribe to yourself.");

  const [author] = await sql<{ subscription_price: number | null }[]>`
    SELECT subscription_price FROM "user" WHERE id = ${id}
  `;
  if (!author) throw new ApiError(404, "Not found.");
  if (!author.subscription_price || author.subscription_price <= 0) {
    throw new ApiError(400, "This author isn't offering a subscription.");
  }

  // Already subscribed and not lapsed → no charge. If they'd cancelled, just
  // un-cancel (resume renewal); otherwise it's a no-op. Guards against a stray
  // re-subscribe so the reader is never billed twice for an active period.
  const [active] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM subscriptions
    WHERE subscriber_id = ${me} AND author_id = ${id} AND expires_at > now()
  `;
  if (active) {
    await sql`
      UPDATE subscriptions SET cancelled = false
      WHERE subscriber_id = ${me} AND author_id = ${id}
    `;
    return NextResponse.json({ subscribed: true, alreadyActive: true });
  }

  // New (or lapsed-then-renewed) subscriptions last 30 days.
  await sql`
    INSERT INTO subscriptions (subscriber_id, author_id, amount, expires_at)
    VALUES (${me}, ${id}, ${author.subscription_price}, now() + interval '30 days')
    ON CONFLICT (subscriber_id, author_id) DO UPDATE
      SET amount = ${author.subscription_price},
          created_at = now(),
          expires_at = GREATEST(subscriptions.expires_at, now()) + interval '30 days',
          expiry_notified = false,
          cancelled = false
  `;

  await notify({
    userId: id,
    kind: "subscribe",
    actorId: me,
    data: { amount: author.subscription_price },
  });

  return NextResponse.json({ subscribed: true });
});

// Cancel a subscription — stops future renewal but keeps access until the paid
// period runs out. (The row lapses naturally at expires_at.)
export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const session = await requireSession();

  await sql`
    UPDATE subscriptions SET cancelled = true
    WHERE subscriber_id = ${session.user.id} AND author_id = ${id}
  `;

  return NextResponse.json({ subscribed: false });
});

