import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE = 1500;

// A reader with access leaves (or updates) their star review of a story.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const stars = Number(body.stars);
  // Must be 0.5–5 in half-star steps.
  if (!(stars >= 0.5 && stars <= 5 && Number.isInteger(stars * 2))) {
    throw new ApiError(400, "Please pick a rating between 0.5 and 5 stars.");
  }
  const liked =
    typeof body.liked === "string" ? body.liked.trim().slice(0, MAX_NOTE) || null : null;
  const disliked =
    typeof body.disliked === "string" ? body.disliked.trim().slice(0, MAX_NOTE) || null : null;

  // Only readers with access may review: the author, a public story, an active
  // subscriber, or anyone holding an active access grant.
  const [acc] = await sql<{ allowed: boolean; author_id: string }[]>`
    SELECT s.author_id, (
      s.author_id = ${userId}
      OR s.chapters_public
      OR EXISTS (
        SELECT 1 FROM subscriptions
        WHERE subscriber_id = ${userId} AND author_id = s.author_id AND expires_at > now()
      )
      OR EXISTS (
        SELECT 1 FROM access_grants
        WHERE story_id = s.id AND user_id = ${userId}
          AND (expires_at IS NULL OR expires_at > now())
      )
    ) AS allowed
    FROM stories s WHERE s.id = ${id}
  `;
  if (!acc) throw new ApiError(404, "Not found.");
  if (!acc.allowed) {
    throw new ApiError(403, "You need access to this story to review it.");
  }

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO reviews (story_id, user_id, stars, liked, disliked)
    VALUES (${id}, ${userId}, ${stars}, ${liked}, ${disliked})
    ON CONFLICT (story_id, user_id) DO UPDATE
      SET stars = ${stars}, liked = ${liked}, disliked = ${disliked}, updated_at = now()
    RETURNING id
  `;

  // Let the author know their story was rated (skips self-reviews via notify).
  await notify({
    userId: acc.author_id,
    kind: "review",
    actorId: userId,
    storyId: id,
    data: { stars },
  });

  return NextResponse.json({ id: row.id, stars, liked, disliked });
});

// Remove the reader's own review.
export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  await sql`DELETE FROM reviews WHERE story_id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
});
