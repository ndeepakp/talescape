import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Toggle a like on a post. Liking notifies the post's author; unliking removes
// that notification so a like/unlike toggle doesn't leave a stale ping.
export const POST = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const userId = session.user.id;

  const [post] = await sql<{ author_id: string }[]>`
    SELECT author_id FROM posts WHERE id = ${id}
  `;
  if (!post) throw new ApiError(404, "Not found.");

  const [existing] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM post_likes WHERE post_id = ${id} AND user_id = ${userId}
  `;
  if (existing) {
    await sql`DELETE FROM post_likes WHERE post_id = ${id} AND user_id = ${userId}`;
    // Withdraw the like notification we sent the author (best-effort).
    await sql`
      DELETE FROM notifications
      WHERE kind = 'post_like' AND user_id = ${post.author_id}
        AND actor_id = ${userId} AND data->>'post_id' = ${id}
    `;
    return NextResponse.json({ liked: false });
  }
  await sql`
    INSERT INTO post_likes (post_id, user_id) VALUES (${id}, ${userId})
    ON CONFLICT DO NOTHING
  `;
  await notify({
    userId: post.author_id,
    kind: "post_like",
    actorId: userId,
    data: { post_id: id },
  });
  return NextResponse.json({ liked: true });
});
