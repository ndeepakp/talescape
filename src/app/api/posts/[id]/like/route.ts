import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Toggle a like on a post. (Post likes don't notify — only @mentions do.)
export const POST = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();

  const [existing] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM post_likes WHERE post_id = ${id} AND user_id = ${session.user.id}
  `;
  if (existing) {
    await sql`DELETE FROM post_likes WHERE post_id = ${id} AND user_id = ${session.user.id}`;
    return NextResponse.json({ liked: false });
  }
  await sql`
    INSERT INTO post_likes (post_id, user_id) VALUES (${id}, ${session.user.id})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ liked: true });
});
