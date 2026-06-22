import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAppearance } from "@/lib/get-appearance";
import { Bookshelf, type BookshelfStory } from "@/components/story/Bookshelf";
import { WeekPanel, type WeekStats } from "@/components/feed/WeekPanel";
import { NewChapters, type NewChapterStory } from "@/components/feed/NewChapters";
import { ContinueReading } from "@/components/feed/ContinueReading";
import { PostsFeed } from "@/components/post/PostsFeed";
import { SideTabs } from "@/components/feed/SideTabs";
import { getPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Optional custom wallpaper for the feed page (set in Settings). Reuses the
  // already-resolved session so there's no extra auth lookup.
  const { feedWallpaper: wallpaper } = await getAppearance(session);

  // "Continue reading": the reader's most recently opened chapter, in a story
  // they don't own that's still published. New readers get nothing.
  const [resume] = await sql<
    { story_id: string; title: string; author: string | null; chapter_index: number }[]
  >`
    SELECT rp.story_id, s.title, u.name AS author, rp.chapter_index
    FROM reading_progress rp
    JOIN stories s ON s.id = rp.story_id
    JOIN "user" u ON u.id = s.author_id
    WHERE rp.user_id = ${session.user.id}
      AND s.status = 'published'
      AND s.author_id <> ${session.user.id}
    ORDER BY rp.updated_at DESC
    LIMIT 1
  `;

  // Community posts (newest first, all authors).
  const posts = await getPosts({ viewerId: session.user.id });

  // "Your week" — the reader's last-7-days activity for the feed right-rail panel.
  const me = session.user.id;
  const [reads] = await sql<{ n: number }[]>`
    SELECT COUNT(DISTINCT story_id)::int AS n FROM story_views
    WHERE viewer_id = ${me} AND created_at >= now() - interval '7 days'
  `;
  const [quiz] = await sql<{ total: number; correct: number }[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE a.choice = (q.value->>'answer')::int)::int AS correct
    FROM question_answers a
    JOIN stories s ON s.id = a.story_id
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(s.chapters -> a.chapter_index -> 'questions', '[]'::jsonb)
    ) q
    WHERE a.user_id = ${me}
      AND a.created_at >= now() - interval '7 days'
      AND q.value->>'id' = a.question_id
  `;
  const [ans] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM posts
    WHERE author_id = ${me} AND answer_story_id IS NOT NULL
      AND created_at >= now() - interval '7 days'
  `;
  const weekStats: WeekStats = {
    name: session.user.name ?? null,
    storiesRead: reads?.n ?? 0,
    quizzesTaken: quiz?.total ?? 0,
    quizScore: quiz && quiz.total > 0 ? Math.round((quiz.correct / quiz.total) * 100) : 0,
    answers: ans?.n ?? 0,
  };

  // "New chapters for you": stories with unseen new_chapter notifications — the
  // serial loop's pull-back, surfaced as a strip at the top of the feed.
  const newChapters = await sql<NewChapterStory[]>`
    SELECT s.id, s.slug, s.title, u.name AS author,
           s.cover_url, s.cover_style,
           COALESCE(rp.chapter_index, 0) AS chapter_index,
           COUNT(*)::int AS new_count
    FROM notifications n
    JOIN stories s ON s.id = n.story_id
    JOIN "user" u ON u.id = s.author_id
    LEFT JOIN reading_progress rp ON rp.story_id = s.id AND rp.user_id = ${me}
    WHERE n.user_id = ${me} AND n.kind = 'new_chapter' AND NOT n.seen
      AND s.status = 'published'
    GROUP BY s.id, u.name, rp.chapter_index
    ORDER BY MAX(n.created_at) DESC
    LIMIT 12
  `;

  // Personalised feed: only stories tagged with one of the reader's favourite
  // genres. A reader with no saved genres (e.g. older accounts) sees everything.
  const stories = await sql<BookshelfStory[]>`
    WITH prefs AS (
      SELECT genre_id FROM user_genres WHERE user_id = ${session.user.id}
    )
    SELECT
      s.id,
      s.slug,
      s.title,
      s.summary,
      u.name AS author,
      u.id AS author_id,
      u.username AS author_handle,
      COALESCE(array_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres,
      (SELECT ROUND(AVG(stars), 1) FROM reviews rv WHERE rv.story_id = s.id)::float AS rating,
      (SELECT COUNT(*) FROM reviews rv WHERE rv.story_id = s.id)::int AS rating_count,
      (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id)::int AS views,
      s.cover_url,
      s.cover_style,
      s.chapters_public,
      s.whole_prices,
      s.currency
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    LEFT JOIN story_genres sg ON sg.story_id = s.id
    LEFT JOIN genres g ON g.id = sg.genre_id
    WHERE s.status = 'published'
      AND (
        NOT EXISTS (SELECT 1 FROM prefs)
        OR EXISTS (
             SELECT 1 FROM story_genres sgm
             JOIN prefs p ON p.genre_id = sgm.genre_id
             WHERE sgm.story_id = s.id
           )
      )
    GROUP BY s.id, u.name, u.id
    ORDER BY s.created_at DESC
  `;

  return (
    <div
      className="min-h-screen bg-[var(--page)] bg-cover bg-center bg-fixed px-6 py-12"
      style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}
    >
      <div className="mx-auto w-full max-w-6xl">
        <h1
          className={
            "text-2xl font-bold text-zinc-900 dark:text-zinc-50 " +
            (wallpaper
              ? "inline-block rounded-xl bg-[var(--page)]/70 px-3 py-1 backdrop-blur-sm"
              : "")
          }
        >
          Your feed
        </h1>

        {resume &&
          (await cookies()).get("resume_dismissed")?.value !==
            `${resume.story_id}:${resume.chapter_index}` && (
            <ContinueReading resume={resume} />
          )}

        <NewChapters stories={newChapters} />

        <SideTabs
          tabs={[
            {
              key: "stories",
              label: "Stories",
              icon: "📚",
              content:
                stories.length === 0 ? (
                  <p className="text-zinc-500">
                    No stories in your favourite genres yet. Why not{" "}
                    <Link href="/write" className="underline">write one</Link>?
                  </p>
                ) : (
                  <Bookshelf
                    stories={stories}
                    rightExtra={<WeekPanel stats={weekStats} />}
                  />
                ),
            },
            {
              key: "posts",
              label: "Posts",
              icon: "💬",
              content: (
                <div className="max-w-2xl">
                  <PostsFeed posts={posts} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
