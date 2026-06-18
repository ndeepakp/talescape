import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 1000;

// List a post's comments (lazy-loaded when a reader expands them).
export const GET = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  await requireSession();
  const comments = await sql`
    SELECT c.id, c.body, c.created_at,
           u.name AS author, u.username AS handle, u.image
    FROM post_comments c JOIN "user" u ON u.id = c.author_id
    WHERE c.post_id = ${id}
    ORDER BY c.created_at
  `;
  return NextResponse.json({ comments });
});

// Add a comment to a post.
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");
  const session = await requireSession();
  const raw = (await req.json().catch(() => ({}))).body;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new ApiError(400, "Write a comment.");
  if (text.length > MAX_BODY) throw new ApiError(400, "That comment is too long.");

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO post_comments (post_id, author_id, body)
    VALUES (${id}, ${session.user.id}, ${text})
    RETURNING id
  `;
  return NextResponse.json({ id: row.id });
});
