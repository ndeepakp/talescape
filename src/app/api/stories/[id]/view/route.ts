import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Records one view of a story. Deduped to once per (viewer, hour); the author's
// own views of their story are never counted.
export const POST = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");

  const session = await requireSession();

  const [story] = await sql<{ author_id: string }[]>`
    SELECT author_id FROM stories WHERE id = ${id}
  `;
  if (!story) throw new ApiError(404, "Not found.");

  if (story.author_id !== session.user.id) {
    // Count this view only if the reader hasn't viewed this story in the last hour.
    await sql`
      INSERT INTO story_views (story_id, viewer_id)
      SELECT ${id}, ${session.user.id}
      WHERE NOT EXISTS (
        SELECT 1 FROM story_views
        WHERE story_id = ${id} AND viewer_id = ${session.user.id}
          AND created_at > now() - interval '1 hour'
      )
    `;
  }

  return NextResponse.json({ ok: true });
});
