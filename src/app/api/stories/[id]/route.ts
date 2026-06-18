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
import { uniqueStorySlug } from "@/lib/slug";
import { normalizeCoverStyle } from "@/lib/cover-style";
import { notify } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PUT = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    throw new ApiError(404, "Not found.");
  }

  const session = await requireSession();

  // Only the author may edit. Grab the prior chapter count so we can detect a
  // newly-added chapter after the update.
  const [owned] = await sql<{ id: string; old_chapters: number }[]>`
    SELECT id, jsonb_array_length(chapters) AS old_chapters
    FROM stories WHERE id = ${id} AND author_id = ${session.user.id}
  `;
  if (!owned) {
    throw new ApiError(403, "Not allowed.");
  }

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
    coverStyle,
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
  const coverStyleVal = cover ? null : normalizeCoverStyle(coverStyle);

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

  // Internal, server-only plain text for the originality checks (never exposed
  // to non-authors). Falls back to the summary when there are no chapters yet.
  const bodyPlain =
    cleanChapters.map((c) => htmlToText(c.body)).join("\n\n").trim() ||
    cleanSummary;

  // Drafts skip the originality check; it only matters when publishing.
  let vec: string | null = null;
  let matches: { id: string; title: string; author: string | null; similarity: number }[] = [];
  if (!isDraft) {
    // Exclude this story so it can't match itself.
    const result = await findSimilar(`${cleanTitle}\n\n${bodyPlain}`, id);
    vec = result.vec;
    matches = result.matches;
    if (matches.length > 0 && !decision) {
      return NextResponse.json({ status: "similar", matches }, { status: 409 });
    }
  }

  // Keep an existing slug stable (changing it would break shared links); only
  // fill one in for any legacy story that somehow lacks one.
  const slugFallback = await uniqueStorySlug(cleanTitle, id);

  await sql`
    UPDATE stories
    SET title = ${cleanTitle}, slug = COALESCE(slug, ${slugFallback}),
        summary = ${cleanSummary},
        chapters = ${sql.json(cleanChapters)}, body = ${bodyPlain},
        status = ${isDraft ? "draft" : "published"},
        chapters_public = ${isPublic},
        offered_durations = ${offered},
        whole_prices = ${sql.json(wholePriceMap)},
        currency = ${storyCurrency},
        cover_url = ${cover},
        cover_style = ${coverStyleVal ? sql.json(coverStyleVal) : null},
        draft_expires_at = ${isDraft ? sql`now() + interval '7 days'` : null},
        embedding = ${vec ? sql`${vec}::vector` : null}
    WHERE id = ${id}
  `;

  // Replace genres with the new selection.
  await sql`DELETE FROM story_genres WHERE story_id = ${id}`;
  if (Array.isArray(genreIds) && genreIds.length > 0) {
    const genreRows = genreIds
      .filter((g) => Number.isInteger(g))
      .map((g: number) => ({ story_id: id, genre_id: g }));
    if (genreRows.length > 0) {
      await sql`INSERT INTO story_genres ${sql(genreRows, "story_id", "genre_id")} ON CONFLICT DO NOTHING`;
    }
  }

  // Rebuild this story's attributions from the latest decision.
  await sql`DELETE FROM attributions WHERE story_id = ${id}`;
  if (decision === "inspired" && typeof inspiredById === "string") {
    if (matches.some((m) => m.id === inspiredById)) {
      await sql`
        INSERT INTO attributions (story_id, related_story_id, kind)
        VALUES (${id}, ${inspiredById}, 'inspired_by')
        ON CONFLICT DO NOTHING
      `;
    }
  } else if (decision === "discard") {
    for (const m of matches) {
      await sql`
        INSERT INTO attributions (story_id, related_story_id, kind)
        VALUES (${id}, ${m.id}, 'similar')
        ON CONFLICT DO NOTHING
      `;
    }
  }

  // A new chapter on a published story: notify the author's active subscribers
  // and anyone holding an active whole-story pass (they get future chapters).
  if (!isDraft && cleanChapters.length > owned.old_chapters) {
    const recipients = await sql<{ user_id: string }[]>`
      SELECT subscriber_id AS user_id FROM subscriptions
      WHERE author_id = ${session.user.id} AND expires_at > now()
      UNION
      SELECT user_id FROM access_grants
      WHERE story_id = ${id} AND scope = 'whole'
        AND (expires_at IS NULL OR expires_at > now())
    `;
    for (const r of recipients) {
      await notify({
        userId: r.user_id,
        kind: "new_chapter",
        actorId: session.user.id,
        storyId: id,
      });
    }
  }

  return NextResponse.json({ id });
});

export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    throw new ApiError(404, "Not found.");
  }

  const session = await requireSession();

  // Only the author may delete. Reactions, comments, genres and attributions
  // all cascade automatically via ON DELETE CASCADE.
  const deleted = await sql<{ id: string }[]>`
    DELETE FROM stories
    WHERE id = ${id} AND author_id = ${session.user.id}
    RETURNING id
  `;

  if (deleted.length === 0) {
    throw new ApiError(403, "Not allowed.");
  }

  return NextResponse.json({ ok: true });
});
