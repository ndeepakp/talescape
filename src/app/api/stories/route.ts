import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { findSimilar } from "@/lib/similarity";
import { htmlToText, normalizeChapters, validateStory } from "@/lib/story-validation";
import {
  DEFAULT_CURRENCY,
  isCurrency,
  normalizeOfferedDurations,
  normalizePrices,
} from "@/lib/pricing";
import { COVER_PUBLIC_PREFIX } from "@/lib/cover";

export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();

  const {
    title,
    summary,
    chapters,
    genreIds,
    accepted,
    status,
    chaptersPublic,
    offeredDurations,
    wholePrices,
    currency,
    coverUrl,
    decision,
    inspiredById,
  } = await req.json().catch(() => ({}));

  const isDraft = status === "draft";
  const isPublic = chaptersPublic === true;
  const offered = normalizeOfferedDurations(offeredDurations);
  const wholePriceMap = normalizePrices(wholePrices, offered);
  const storyCurrency = isCurrency(currency) ? currency : DEFAULT_CURRENCY;
  const cover =
    typeof coverUrl === "string" && coverUrl.startsWith(COVER_PUBLIC_PREFIX)
      ? coverUrl
      : null;

  const invalid = validateStory(
    String(title ?? ""),
    String(summary ?? ""),
    chapters,
    genreIds,
    accepted,
    { draft: isDraft },
  );
  if (invalid) {
    throw new ApiError(400, invalid);
  }

  const cleanTitle = title.trim();
  const cleanSummary = (summary ?? "").trim();
  const cleanChapters = normalizeChapters(chapters, offered);

  // The internal, server-only full text for the originality checks: the plain
  // text of every chapter (HTML stripped). Never shown to non-authors. Falls
  // back to the summary when there are no chapters yet.
  const bodyPlain =
    cleanChapters.map((c) => htmlToText(c.body)).join("\n\n").trim() ||
    cleanSummary;

  // Drafts skip the originality check entirely — it only matters at publish.
  let vec: string | null = null;
  let matches: { id: string; title: string; author: string | null; similarity: number }[] = [];
  if (!isDraft) {
    const result = await findSimilar(`${cleanTitle}\n\n${bodyPlain}`);
    vec = result.vec;
    matches = result.matches;
    if (matches.length > 0 && !decision) {
      return NextResponse.json({ status: "similar", matches }, { status: 409 });
    }
  }

  const [story] = await sql<{ id: string }[]>`
    INSERT INTO stories (
      author_id, title, summary, chapters, body, status, chapters_public,
      offered_durations, whole_prices, currency, cover_url, draft_expires_at, embedding
    )
    VALUES (
      ${session.user.id}, ${cleanTitle}, ${cleanSummary},
      ${sql.json(cleanChapters)}, ${bodyPlain},
      ${isDraft ? "draft" : "published"}, ${isPublic},
      ${offered}, ${sql.json(wholePriceMap)}, ${storyCurrency}, ${cover},
      ${isDraft ? sql`now() + interval '7 days'` : null},
      ${vec ? sql`${vec}::vector` : null}
    )
    RETURNING id
  `;

  if (Array.isArray(genreIds) && genreIds.length > 0) {
    const genreRows = genreIds
      .filter((g) => Number.isInteger(g))
      .map((g: number) => ({ story_id: story.id, genre_id: g }));
    if (genreRows.length > 0) {
      await sql`INSERT INTO story_genres ${sql(genreRows, "story_id", "genre_id")} ON CONFLICT DO NOTHING`;
    }
  }

  // Record how the author resolved any similarity (published stories only).
  if (decision === "inspired" && typeof inspiredById === "string") {
    const valid = matches.some((m) => m.id === inspiredById);
    if (valid) {
      await sql`
        INSERT INTO attributions (story_id, related_story_id, kind)
        VALUES (${story.id}, ${inspiredById}, 'inspired_by')
        ON CONFLICT DO NOTHING
      `;
    }
  } else if (decision === "discard") {
    for (const m of matches) {
      await sql`
        INSERT INTO attributions (story_id, related_story_id, kind)
        VALUES (${story.id}, ${m.id}, 'similar')
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return NextResponse.json({ id: story.id, status: isDraft ? "draft" : "published" });
});
