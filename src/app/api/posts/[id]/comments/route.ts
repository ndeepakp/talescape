import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { cleanSnippet, extractMentions, extractStoryMentions } from "@/lib/mentions";
import { notify } from "@/lib/notify";

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
  const userId = session.user.id;
  const raw = (await req.json().catch(() => ({}))).body;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new ApiError(400, "Write a comment.");
  if (text.length > MAX_BODY) throw new ApiError(400, "That comment is too long.");

  const [post] = await sql<{ author_id: string }[]>`
    SELECT author_id FROM posts WHERE id = ${id}
  `;
  if (!post) throw new ApiError(404, "Not found.");

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO post_comments (post_id, author_id, body)
    VALUES (${id}, ${userId}, ${text})
    RETURNING id
  `;

  const snippet = cleanSnippet(text);

  // Notify the post's author that someone commented.
  await notify({
    userId: post.author_id,
    kind: "post_comment",
    actorId: userId,
    data: { post_id: id, snippet },
  });

  // Notify any @mentioned users in the comment (deduped; the commenter and the
  // post author already got their own pings above and via notify's self-check).
  const handles = extractMentions(text);
  if (handles.length > 0) {
    const users = await sql<{ id: string }[]>`
      SELECT id FROM "user" WHERE lower(username) = ANY(${handles})
    `;
    for (const u of users) {
      if (u.id === post.author_id) continue; // already notified as the post author
      await notify({
        userId: u.id,
        kind: "mention",
        actorId: userId,
        data: { post_id: id, snippet },
      });
    }
  }

  // Notify the author of any story mentioned in the comment (slug or legacy UUID).
  const storyRefs = extractStoryMentions(text);
  if (storyRefs.length > 0) {
    const stories = await sql<{ id: string; author_id: string }[]>`
      SELECT id, author_id FROM stories
      WHERE slug = ANY(${storyRefs}) OR id::text = ANY(${storyRefs})
    `;
    for (const s of stories) {
      await notify({
        userId: s.author_id,
        kind: "story_mention",
        actorId: userId,
        storyId: s.id,
        data: { post_id: id, snippet },
      });
    }
  }

  return NextResponse.json({ id: row.id });
});
