import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAppearance } from "@/lib/get-appearance";
import { Bookshelf, type BookshelfStory } from "@/components/Bookshelf";
import { ContinueReading } from "@/components/ContinueReading";
import { PostsFeed } from "@/components/PostsFeed";
import { SideTabs } from "@/components/SideTabs";
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

  // Personalised feed: only stories tagged with one of the reader's favourite
  // genres. A reader with no saved genres (e.g. older accounts) sees everything.
  const stories = await sql<BookshelfStory[]>`
    WITH prefs AS (
      SELECT genre_id FROM user_genres WHERE user_id = ${session.user.id}
    )
    SELECT
      s.id,
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

        <SideTabs
          tabs={[
            {
              key: "stories",
              label: "Stories",
              icon: "📚",
              count: stories.length,
              content:
                stories.length === 0 ? (
                  <p className="text-zinc-500">
                    No stories in your favourite genres yet. Why not{" "}
                    <Link href="/write" className="underline">write one</Link>?
                  </p>
                ) : (
                  <Bookshelf stories={stories} />
                ),
            },
            {
              key: "posts",
              label: "Posts",
              icon: "💬",
              count: posts.length,
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
