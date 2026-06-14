import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LENGTH = 2000;

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
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const { body } = await req.json();
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment is too long (max ${MAX_LENGTH} characters).` },
      { status: 400 },
    );
  }

  const [comment] = await sql`
    INSERT INTO comments (story_id, user_id, body)
    VALUES (${id}, ${session.user.id}, ${text})
    RETURNING id
  `;

  // Notify the story's author (skipped automatically if commenting on own story).
  const [story] = await sql<{ author_id: string }[]>`
    SELECT author_id FROM stories WHERE id = ${id}
  `;
  if (story) {
    await notify({
      userId: story.author_id,
      kind: "comment",
      actorId: session.user.id,
      storyId: id,
      data: { snippet: text.slice(0, 100) },
    });
  }

  return NextResponse.json({ id: comment.id });
}
