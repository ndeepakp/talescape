import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function counts(storyId: string) {
  const [row] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE value = 1)::int AS likes,
      COUNT(*) FILTER (WHERE value = -1)::int AS dislikes
    FROM reactions
    WHERE story_id = ${storyId}
  `;
  return row as { likes: number; dislikes: number };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Sign in to react." }, { status: 401 });
  }

  const { value } = await req.json();
  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  const userId = session.user.id;
  const [existing] = await sql`
    SELECT value FROM reactions WHERE story_id = ${id} AND user_id = ${userId}
  `;

  let userReaction: number | null;
  if (existing && existing.value === value) {
    // Clicking the same button again removes the reaction.
    await sql`DELETE FROM reactions WHERE story_id = ${id} AND user_id = ${userId}`;
    userReaction = null;
  } else {
    await sql`
      INSERT INTO reactions (story_id, user_id, value)
      VALUES (${id}, ${userId}, ${value})
      ON CONFLICT (story_id, user_id)
      DO UPDATE SET value = EXCLUDED.value, created_at = now()
    `;
    userReaction = value;

    // Notify the story's author of the like / dislike.
    const [story] = await sql<{ author_id: string }[]>`
      SELECT author_id FROM stories WHERE id = ${id}
    `;
    if (story) {
      await notify({
        userId: story.author_id,
        kind: "reaction",
        actorId: userId,
        storyId: id,
        data: { value },
      });
    }
  }

  return NextResponse.json({ ...(await counts(id)), userReaction });
}
