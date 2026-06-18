import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PINS = 3;

// The story's author pins/unpins a review so it's featured at the top.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const wantPin = (await req.json().catch(() => ({}))).pinned === true;

  const [rev] = await sql<{ story_id: string; author_id: string }[]>`
    SELECT r.story_id, s.author_id
    FROM reviews r JOIN stories s ON s.id = r.story_id
    WHERE r.id = ${id}
  `;
  if (!rev) throw new ApiError(404, "Not found.");
  if (rev.author_id !== session.user.id) {
    throw new ApiError(403, "Only the story's author can pin reviews.");
  }

  if (wantPin) {
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM reviews
      WHERE story_id = ${rev.story_id} AND pinned = true AND id <> ${id}
    `;
    if (count >= MAX_PINS) {
      throw new ApiError(400, `You can feature up to ${MAX_PINS} reviews.`);
    }
  }

  await sql`UPDATE reviews SET pinned = ${wantPin} WHERE id = ${id}`;
  return NextResponse.json({ ok: true, pinned: wantPin });
});
