import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession, withErrors } from "@/lib/http";

const ALLOWED = [7, 14, 30, 90];

type Point = { label: string; value: number };

// Author analytics over a selectable window (last N days): daily views,
// purchases and earnings across the signed-in user's own stories.
export const GET = withErrors(async (req: Request) => {
  const session = await requireSession();
  const me = session.user.id;

  const raw = Number(new URL(req.url).searchParams.get("days"));
  const days = ALLOWED.includes(raw) ? raw : 7;
  const span = days - 1;

  const views = await sql<Point[]>`
    SELECT to_char(d, 'MM/DD') AS label, COALESCE(x.cnt, 0)::int AS value
    FROM generate_series(current_date - ${span}::int, current_date, interval '1 day') d
    LEFT JOIN (
      SELECT sv.day, COUNT(*) AS cnt
      FROM story_views sv JOIN stories s ON s.id = sv.story_id
      WHERE s.author_id = ${me} AND sv.day >= current_date - ${span}::int
      GROUP BY sv.day
    ) x ON x.day = d::date
    ORDER BY d
  `;

  const purchases = await sql<Point[]>`
    SELECT to_char(d, 'MM/DD') AS label, COALESCE(x.cnt, 0)::int AS value
    FROM generate_series(current_date - ${span}::int, current_date, interval '1 day') d
    LEFT JOIN (
      SELECT ag.created_at::date AS day, COUNT(*) AS cnt
      FROM access_grants ag JOIN stories s ON s.id = ag.story_id
      WHERE s.author_id = ${me} AND ag.created_at >= current_date - ${span}::int
      GROUP BY 1
    ) x ON x.day = d::date
    ORDER BY d
  `;

  // Earnings combine one-off purchases and subscription payments.
  const earnings = await sql<Point[]>`
    SELECT to_char(d, 'MM/DD') AS label, COALESCE(x.amt, 0)::int AS value
    FROM generate_series(current_date - ${span}::int, current_date, interval '1 day') d
    LEFT JOIN (
      SELECT e.day, SUM(e.amount) AS amt
      FROM (
        SELECT ag.created_at::date AS day, ag.amount
        FROM access_grants ag JOIN stories s ON s.id = ag.story_id
        WHERE s.author_id = ${me} AND ag.created_at >= current_date - ${span}::int
        UNION ALL
        SELECT sub.created_at::date AS day, sub.amount
        FROM subscriptions sub
        WHERE sub.author_id = ${me} AND sub.created_at >= current_date - ${span}::int
      ) e
      GROUP BY e.day
    ) x ON x.day = d::date
    ORDER BY d
  `;

  // Point-in-time count of readers currently subscribed to this author.
  const [subRow] = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM subscriptions
    WHERE author_id = ${me} AND expires_at > now()
  `;

  return NextResponse.json({
    days,
    views,
    purchases,
    earnings,
    subscribers: subRow?.c ?? 0,
  });
});
