import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 80;

// Lists the current user's collections. If ?storyId is given, each row also
// reports whether that story is already in the collection (for the save menu).
export const GET = withErrors(async (req: Request) => {
  const session = await requireSession();
  const storyId = new URL(req.url).searchParams.get("storyId");
  const sid = storyId && UUID_RE.test(storyId) ? storyId : null;

  const items = await sql<
    { id: string; name: string; count: number; contains: boolean }[]
  >`
    SELECT c.id, c.name,
           COUNT(cs.story_id)::int AS count,
           COALESCE(bool_or(cs.story_id = ${sid}), false) AS contains
    FROM collections c
    LEFT JOIN collection_stories cs ON cs.collection_id = c.id
    WHERE c.user_id = ${session.user.id}
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;

  return NextResponse.json({ items });
});

// Creates a collection. If storyId is given, the story is added to it.
export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();
  const { name, storyId } = await req.json().catch(() => ({}));

  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean) throw new ApiError(400, "Please name your collection.");
  if (clean.length > MAX_NAME) throw new ApiError(400, "That name is too long.");

  const [collection] = await sql<{ id: string }[]>`
    INSERT INTO collections (user_id, name) VALUES (${session.user.id}, ${clean})
    RETURNING id
  `;

  if (typeof storyId === "string" && UUID_RE.test(storyId)) {
    await sql`
      INSERT INTO collection_stories (collection_id, story_id)
      VALUES (${collection.id}, ${storyId})
      ON CONFLICT DO NOTHING
    `;
  }

  return NextResponse.json({ id: collection.id, name: clean });
});
