import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { expiryFor, isTier, type Tier } from "@/lib/pricing";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoryRow = {
  author_id: string;
  status: string;
  chapters_public: boolean;
  offered_durations: string[];
  whole_prices: Record<string, number>;
  chapters: { prices?: Record<string, number> }[];
};

// A reader buys access. This is a MOCK checkout: no real money moves. The
// price is computed server-side from the story's pricing (never trusted from
// the client), a grant is recorded, and access is immediate.
//
// Body: { duration, scope: 'whole' } or { duration, scope: 'chapters', chapterIndexes: number[] }
export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");

  const session = await requireSession();
  const buyer = session.user.id;

  const [story] = await sql<StoryRow[]>`
    SELECT author_id, status, chapters_public, offered_durations, whole_prices, chapters
    FROM stories WHERE id = ${id}
  `;
  if (!story || story.status !== "published") throw new ApiError(404, "Not found.");
  if (story.chapters_public) throw new ApiError(400, "These chapters are already free to read.");
  if (story.author_id === buyer) throw new ApiError(400, "You can't buy your own story.");

  const body = await req.json().catch(() => ({}));
  const duration = body.duration;
  if (!isTier(duration) || !story.offered_durations.includes(duration)) {
    throw new ApiError(400, "That access option isn't available.");
  }
  const tier = duration as Tier;
  const expires = expiryFor(tier);

  // Build the list of grant rows + total price from the server-side pricing.
  const rows: {
    story_id: string;
    user_id: string;
    scope: string;
    chapter_index: number | null;
    duration: string;
    amount: number;
    expires_at: Date | null;
  }[] = [];

  if (body.scope === "whole") {
    const price = story.whole_prices?.[tier];
    if (typeof price !== "number") {
      throw new ApiError(400, "The whole story isn't sold for that duration.");
    }
    rows.push({
      story_id: id, user_id: buyer, scope: "whole", chapter_index: null,
      duration: tier, amount: price, expires_at: expires,
    });
  } else if (body.scope === "chapters") {
    const idxs: number[] = Array.isArray(body.chapterIndexes)
      ? [...new Set(body.chapterIndexes.filter((n: unknown) => Number.isInteger(n)))] as number[]
      : [];
    if (idxs.length === 0) throw new ApiError(400, "Pick at least one chapter.");
    for (const i of idxs) {
      const price = story.chapters[i]?.prices?.[tier];
      if (typeof price !== "number") {
        throw new ApiError(400, `Chapter ${i + 1} isn't sold for that duration.`);
      }
      rows.push({
        story_id: id, user_id: buyer, scope: "chapter", chapter_index: i,
        duration: tier, amount: price, expires_at: expires,
      });
    }
  } else {
    throw new ApiError(400, "Choose what to buy.");
  }

  await sql`
    INSERT INTO access_grants ${sql(
      rows,
      "story_id",
      "user_id",
      "scope",
      "chapter_index",
      "duration",
      "amount",
      "expires_at",
    )}
  `;

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const boughtWhole = rows.some((r) => r.scope === "whole");

  await notify({
    userId: story.author_id,
    kind: "purchase",
    actorId: buyer,
    storyId: id,
    data: {
      whole: boughtWhole,
      units: rows.filter((r) => r.scope === "chapter").length,
      total,
    },
  });

  return NextResponse.json({ ok: true, total });
});

// The author revokes all of a reader's access to this story.
// Body: { userId }
export const DELETE = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new ApiError(404, "Not found.");

  const session = await requireSession();
  const { userId } = await req.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId) throw new ApiError(400, "Missing reader.");

  const removed = await sql<{ id: string }[]>`
    DELETE FROM access_grants ag
    USING stories s
    WHERE ag.story_id = ${id}
      AND ag.user_id = ${userId}
      AND s.id = ag.story_id
      AND s.author_id = ${session.user.id}
    RETURNING ag.id
  `;
  if (removed.length === 0) throw new ApiError(403, "Not allowed.");

  return NextResponse.json({ ok: true });
});
