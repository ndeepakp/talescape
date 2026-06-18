import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Delete your own post (cascades to its likes and comments).
export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const [deleted] = await sql<{ id: string }[]>`
    DELETE FROM posts WHERE id = ${id} AND author_id = ${session.user.id}
    RETURNING id
  `;
  if (deleted) {
    // Remove the mention notifications this post created (post_mentions and the
    // post's likes/comments are cleaned up by ON DELETE CASCADE).
    await sql`
      DELETE FROM notifications
      WHERE kind IN ('mention', 'story_mention', 'post_like', 'post_comment')
        AND data->>'post_id' = ${id}
    `;
  }
  return NextResponse.json({ ok: true });
});
