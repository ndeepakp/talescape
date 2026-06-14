import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verifies the collection belongs to the caller.
async function ownCollection(collectionId: string, userId: string) {
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE id = ${collectionId} AND user_id = ${userId}
  `;
  return !!row;
}

// Add a story to a collection.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");

  const session = await requireSession();
  const { storyId } = await req.json().catch(() => ({}));
  if (typeof storyId !== "string" || !UUID_RE.test(storyId)) {
    throw new ApiError(400, "Bad story.");
  }
  if (!(await ownCollection(id, session.user.id))) throw new ApiError(403, "Not allowed.");

  await sql`
    INSERT INTO collection_stories (collection_id, story_id)
    VALUES (${id}, ${storyId})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ inCollection: true });
});

// Remove a story from a collection.
export const DELETE = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");

  const session = await requireSession();
  const { storyId } = await req.json().catch(() => ({}));
  if (typeof storyId !== "string" || !UUID_RE.test(storyId)) {
    throw new ApiError(400, "Bad story.");
  }
  if (!(await ownCollection(id, session.user.id))) throw new ApiError(403, "Not allowed.");

  await sql`
    DELETE FROM collection_stories WHERE collection_id = ${id} AND story_id = ${storyId}
  `;
  return NextResponse.json({ inCollection: false });
});
