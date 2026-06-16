import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentForm } from "@/components/CommentForm";
import { DeleteStoryButton } from "@/components/DeleteStoryButton";
import { AccessPanel } from "@/components/AccessPanel";
import { ApprovedReadersList } from "@/components/ApprovedReadersList";
import { ViewTracker } from "@/components/ViewTracker";
import { ChapterReader, type Bookmark } from "@/components/ChapterReader";
import { SaveToCollection } from "@/components/SaveToCollection";
import { type Tier } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Story = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  chapters_public: boolean;
  offered_durations: Tier[];
  whole_prices: Partial<Record<Tier, number>>;
  currency: string;
  cover_url: string | null;
  created_at: string;
  author: string | null;
  author_id: string;
  author_handle: string | null;
  genres: string[];
};

type Chapter = {
  title: string | null;
  body: string;
  prices?: Partial<Record<Tier, number>>;
};

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { id } = await params;
  const { chapter: chapterParam } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Public columns only. The private "chapters" (and the internal "body") are
  // fetched separately and ONLY for the author — they are never selected here,
  // so they cannot leak into the page for a non-author viewer.
  const rows = await sql<Story[]>`
    SELECT
      s.id,
      s.title,
      s.summary,
      s.status,
      s.chapters_public,
      s.offered_durations,
      s.whole_prices,
      s.currency,
      s.cover_url,
      s.created_at,
      u.name AS author,
      u.id AS author_id,
      u.username AS author_handle,
      COALESCE(array_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    LEFT JOIN story_genres sg ON sg.story_id = s.id
    LEFT JOIN genres g ON g.id = sg.genre_id
    WHERE s.id = ${id}
    GROUP BY s.id, u.name, u.id
  `;

  const story = rows[0];
  if (!story) notFound();

  const isAuthor = session.user.id === story.author_id;

  // A draft is private to its author — nobody else can reach it, not even its
  // public summary.
  if (story.status === "draft" && !isAuthor) notFound();

  // Public stats: distinct readers who bought access (used in the buy panel),
  // and total views from readers other than the author (story_views excludes the
  // author at insert time).
  const [counts] = await sql<{ buyers: number; views: number }[]>`
    SELECT
      (SELECT COUNT(DISTINCT user_id) FROM access_grants WHERE story_id = ${id})::int AS buyers,
      (SELECT COUNT(*) FROM story_views WHERE story_id = ${id})::int AS views
  `;
  const buyers = counts?.buyers ?? 0;
  const views = counts?.views ?? 0;

  // The full chapters (with per-chapter prices). We fetch them all server-side,
  // but only ever render the BODY of chapters this viewer may read — locked
  // chapter bodies are never placed in the HTML.
  const [crow] = await sql<{ chapters: Chapter[] }[]>`
    SELECT chapters FROM stories WHERE id = ${id}
  `;
  const allChapters: Chapter[] = Array.isArray(crow?.chapters) ? crow.chapters : [];

  // Per-chapter access. The author and public stories unlock everything; a
  // reader unlocks the whole story (via a 'whole' grant) or individual chapters
  // they bought, as long as the grant hasn't expired.
  let unlockedWhole = isAuthor || story.chapters_public;
  const unlockedIdx = new Set<number>();
  if (!isAuthor && !story.chapters_public) {
    // An active subscription to the author unlocks all their private chapters.
    const [sub] = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM subscriptions
      WHERE subscriber_id = ${session.user.id} AND author_id = ${story.author_id}
        AND expires_at > now()
    `;
    if (sub) unlockedWhole = true;

    const grants = await sql<{ scope: string; chapter_index: number | null }[]>`
      SELECT scope, chapter_index FROM access_grants
      WHERE story_id = ${id} AND user_id = ${session.user.id}
        AND (expires_at IS NULL OR expires_at > now())
    `;
    for (const g of grants) {
      if (g.scope === "whole") unlockedWhole = true;
      else if (g.chapter_index !== null) unlockedIdx.add(g.chapter_index);
    }
  }
  const chapterUnlocked = (i: number) => unlockedWhole || unlockedIdx.has(i);
  const anyLocked = allChapters.some((_, i) => !chapterUnlocked(i));
  const purchasable =
    !isAuthor &&
    !story.chapters_public &&
    story.offered_durations.length > 0 &&
    anyLocked;

  // This reader's bookmarks for this story (to show + jump to).
  const bookmarks =
    allChapters.length > 0
      ? await sql<Bookmark[]>`
          SELECT id, chapter_index, quote FROM bookmarks
          WHERE user_id = ${session.user.id} AND story_id = ${id}
          ORDER BY created_at
        `
      : [];

  // Which chapter to open first: the ?chapter param (from a "continue" link),
  // else the reader's last saved position, else the first.
  let initialChapter = 0;
  let initialPage = 0;
  const paramChapter = chapterParam ? parseInt(chapterParam, 10) : NaN;
  const autoResume = Number.isInteger(paramChapter);
  if (autoResume) {
    initialChapter = paramChapter;
  } else if (allChapters.length > 0) {
    const [prog] = await sql<{ chapter_index: number; page_index: number }[]>`
      SELECT chapter_index, page_index FROM reading_progress
      WHERE user_id = ${session.user.id} AND story_id = ${id}
    `;
    if (prog) {
      initialChapter = prog.chapter_index;
      initialPage = prog.page_index;
    }
  }

  // Author's roster of readers with access (for the revoke controls), grouped
  // per reader.
  let readers: {
    user_id: string;
    name: string | null;
    handle: string | null;
    label: string;
  }[] = [];
  if (isAuthor && !story.chapters_public) {
    const grants = await sql<
      {
        user_id: string;
        name: string | null;
        handle: string | null;
        scope: string;
        chapter_index: number | null;
        active: boolean;
      }[]
    >`
      SELECT ag.user_id, u.name, u.username AS handle, ag.scope, ag.chapter_index,
             (ag.expires_at IS NULL OR ag.expires_at > now()) AS active
      FROM access_grants ag
      JOIN "user" u ON u.id = ag.user_id
      WHERE ag.story_id = ${id}
      ORDER BY u.name NULLS LAST, ag.created_at
    `;
    const byUser = new Map<
      string,
      { name: string | null; handle: string | null; whole: boolean; chapters: Set<number> }
    >();
    for (const g of grants) {
      if (!g.active) continue;
      const e = byUser.get(g.user_id) ?? {
        name: g.name,
        handle: g.handle,
        whole: false,
        chapters: new Set<number>(),
      };
      if (g.scope === "whole") e.whole = true;
      else if (g.chapter_index !== null) e.chapters.add(g.chapter_index);
      byUser.set(g.user_id, e);
    }
    readers = [...byUser.entries()].map(([user_id, e]) => ({
      user_id,
      name: e.name,
      handle: e.handle,
      label: e.whole
        ? "whole story"
        : `${e.chapters.size} chapter${e.chapters.size === 1 ? "" : "s"}`,
    }));
  }

  const [reactionCounts] = await sql<{ likes: number; dislikes: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE value = 1)::int AS likes,
      COUNT(*) FILTER (WHERE value = -1)::int AS dislikes
    FROM reactions
    WHERE story_id = ${id}
  `;

  let userReaction: number | null = null;
  if (session) {
    const [r] = await sql<{ value: number }[]>`
      SELECT value FROM reactions WHERE story_id = ${id} AND user_id = ${session.user.id}
    `;
    userReaction = r?.value ?? null;
  }

  const comments = await sql<
    {
      id: string;
      body: string;
      created_at: string;
      author: string | null;
    }[]
  >`
    SELECT c.id, c.body, c.created_at, u.name AS author
    FROM comments c
    JOIN "user" u ON u.id = c.user_id
    WHERE c.story_id = ${id}
    ORDER BY c.created_at ASC
  `;

  // Stories this one credits or resembles (set at publish time).
  const attributions = await sql<
    {
      kind: "inspired_by" | "similar";
      id: string;
      title: string;
      author: string | null;
    }[]
  >`
    SELECT a.kind, r.id, r.title, ru.name AS author
    FROM attributions a
    JOIN stories r ON r.id = a.related_story_id
    LEFT JOIN "user" ru ON ru.id = r.author_id
    WHERE a.story_id = ${id}
    ORDER BY a.kind
  `;

  const inspiredBy = attributions.filter((a) => a.kind === "inspired_by");
  const similar = attributions.filter((a) => a.kind === "similar");

  const date = new Date(story.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      {!isAuthor && <ViewTracker storyId={story.id} />}
      <article className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4">
            {story.status === "published" && <SaveToCollection storyId={story.id} />}
            {isAuthor && (
              <>
                <Link
                  href={`/stories/${story.id}/edit`}
                  className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  Update
                </Link>
                <DeleteStoryButton storyId={story.id} redirectTo="/feed" />
              </>
            )}
          </div>
        </div>

        {story.status === "draft" && (
          <span className="mt-6 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Draft — only you can see this
          </span>
        )}
        {story.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.cover_url}
            alt={`Cover of ${story.title}`}
            className="mt-4 max-h-96 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
          />
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {story.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          by{" "}
          <Link
            href={`/${story.author_handle ?? story.author_id}`}
            className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
          >
            {story.author ?? "Unknown"}
          </Link>{" "}
          · {date}
        </p>

        {/* View count — readers other than the author who have opened this story. */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <span aria-hidden="true">👁</span>
          <span>
            {views} {views === 1 ? "view" : "views"}
          </span>
        </div>

        {story.genres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {story.genres.map((name) => (
              <span
                key={name}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {inspiredBy.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Inspired by
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {inspiredBy.map((a) => (
                <li key={a.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Link href={`/stories/${a.id}`} className="font-medium underline">
                    {a.title}
                  </Link>{" "}
                  by {a.author ?? "Unknown"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The summary is public — shown to everyone. */}
        <div className="mt-8 whitespace-pre-wrap text-lg leading-8 text-zinc-800 dark:text-zinc-200">
          {story.summary}
        </div>

        {allChapters.length > 0 && (
          <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Chapters
              </h2>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {story.chapters_public
                  ? "Public — free to read"
                  : isAuthor
                    ? "Private — sold to readers"
                    : "Private"}
              </span>
            </div>

            {isAuthor && !story.chapters_public && (
              <>
                <p className="mt-2 text-sm text-zinc-500">
                  {buyers === 0
                    ? "No readers have bought access yet."
                    : `${buyers} ${buyers === 1 ? "reader has" : "readers have"} bought access.`}
                </p>
                <ApprovedReadersList storyId={story.id} readers={readers} />
              </>
            )}

            <ChapterReader
              storyId={story.id}
              chapters={allChapters.map((c, i) => ({
                index: i,
                title: c.title,
                body: chapterUnlocked(i) ? c.body : null,
                locked: !chapterUnlocked(i),
              }))}
              initialChapter={initialChapter}
              initialPage={initialPage}
              initialBookmarks={bookmarks}
              autoResume={autoResume}
            />
          </section>
        )}

        {purchasable ? (
          <AccessPanel
            storyId={story.id}
            offered={story.offered_durations}
            wholePrices={story.whole_prices}
            currency={story.currency}
            chapters={allChapters.map((c, i) => ({
              index: i,
              title: c.title ?? "",
              prices: c.prices ?? {},
              owned: chapterUnlocked(i),
            }))}
          />
        ) : (
          !isAuthor &&
          !story.chapters_public &&
          anyLocked && (
            <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              The author hasn&apos;t put these chapters up for sale yet — check
              back soon.
            </section>
          )
        )}

        <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <ReactionBar
            storyId={story.id}
            initialLikes={reactionCounts.likes}
            initialDislikes={reactionCounts.dislikes}
            initialUserReaction={userReaction}
            isLoggedIn={!!session}
          />
        </div>

        <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Comments ({comments.length})
          </h2>

          <div className="mt-4">
            {session ? (
              <CommentForm storyId={story.id} />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <Link href="/login" className="font-medium underline">
                  Log in
                </Link>{" "}
                to join the conversation.
              </p>
            )}
          </div>

          <ul className="mt-6 flex flex-col gap-4">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {c.author ?? "Unknown"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {similar.length > 0 && (
          <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Similar stories
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {similar.map((a) => (
                <li key={a.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Link href={`/stories/${a.id}`} className="font-medium underline">
                    {a.title}
                  </Link>{" "}
                  by {a.author ?? "Unknown"}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
