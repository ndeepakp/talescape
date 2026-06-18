import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { cleanSnippet, extractMentions, extractStoryMentions } from "@/lib/mentions";
import { notify } from "@/lib/notify";

const MAX_BODY = 2000;

// Create a community post. Only @mentioned users are notified.
export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();
  const raw = (await req.json().catch(() => ({}))).body;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new ApiError(400, "Write something to post.");
  if (text.length > MAX_BODY) throw new ApiError(400, "That post is too long.");

  const [post] = await sql<{ id: string }[]>`
    INSERT INTO posts (author_id, body) VALUES (${session.user.id}, ${text})
    RETURNING id
  `;

  const handles = extractMentions(text);
  if (handles.length > 0) {
    const users = await sql<{ id: string }[]>`
      SELECT id FROM "user" WHERE lower(username) = ANY(${handles})
    `;
    if (users.length > 0) {
      // Record who's mentioned (powers the "Mentioned" filter) and notify them.
      await sql`
        INSERT INTO post_mentions ${sql(
          users.map((u) => ({ post_id: post.id, user_id: u.id })),
          "post_id",
          "user_id",
        )}
        ON CONFLICT DO NOTHING
      `;
      const snippet = cleanSnippet(text);
      for (const u of users) {
        await notify({
          userId: u.id,
          kind: "mention",
          actorId: session.user.id,
          data: { post_id: post.id, snippet },
        });
      }
    }
  }

  // Notify the author of any story mentioned in the post (skips the poster's
  // own stories via notify()'s self-check). Tokens may carry a slug or a legacy
  // UUID, so match on either.
  const storyRefs = extractStoryMentions(text);
  if (storyRefs.length > 0) {
    const stories = await sql<{ id: string; author_id: string }[]>`
      SELECT id, author_id FROM stories
      WHERE slug = ANY(${storyRefs}) OR id::text = ANY(${storyRefs})
    `;
    const snippet = cleanSnippet(text);
    for (const s of stories) {
      await notify({
        userId: s.author_id,
        kind: "story_mention",
        actorId: session.user.id,
        storyId: s.id,
        data: { post_id: post.id, snippet },
      });
    }
  }

  return NextResponse.json({ id: post.id });
});
