import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAppearance } from "@/lib/get-appearance";

export const dynamic = "force-dynamic";

type FeedStory = {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  author: string | null;
  author_id: string;
  author_handle: string | null;
  genres: string[];
  likes: number;
  dislikes: number;
  interests: number;
};

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

  // Personalised feed: only stories tagged with one of the reader's favourite
  // genres. A reader with no saved genres (e.g. older accounts) sees everything.
  const stories = await sql<FeedStory[]>`
    WITH prefs AS (
      SELECT genre_id FROM user_genres WHERE user_id = ${session.user.id}
    )
    SELECT
      s.id,
      s.title,
      s.summary,
      s.created_at,
      u.name AS author,
      u.id AS author_id,
      u.username AS author_handle,
      COALESCE(array_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres,
      (SELECT COUNT(*) FROM reactions r WHERE r.story_id = s.id AND r.value = 1)::int AS likes,
      (SELECT COUNT(*) FROM reactions r WHERE r.story_id = s.id AND r.value = -1)::int AS dislikes,
      (SELECT COUNT(DISTINCT ag.user_id) FROM access_grants ag WHERE ag.story_id = s.id)::int AS interests
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
      <div className="mx-auto w-full max-w-5xl">
        <h1
          className={
            "text-2xl font-bold text-zinc-900 dark:text-zinc-50 " +
            (wallpaper
              ? "inline-block rounded-xl bg-[var(--page)]/70 px-3 py-1 backdrop-blur-sm"
              : "")
          }
        >
          Stories
        </h1>

        {resume && (
          <Link
            href={`/stories/${resume.story_id}?chapter=${resume.chapter_index}`}
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-accent bg-accent/5 p-4 transition-colors hover:bg-accent/10"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                Continue reading
              </p>
              <p className="mt-0.5 truncate font-semibold text-zinc-900 dark:text-zinc-50">
                {resume.title}
              </p>
              <p className="text-sm text-zinc-500">
                Chapter {resume.chapter_index + 1} · by {resume.author ?? "Unknown"}
              </p>
            </div>
            <span className="shrink-0 rounded-full btn-primary px-4 py-2 text-sm font-medium">
              Continue from there →
            </span>
          </Link>
        )}

        {stories.length === 0 ? (
          <p className="mt-12 text-center text-zinc-500">
            No stories in your favourite genres yet. Why not{" "}
            <Link href="/write" className="underline">write one</Link>?
          </p>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {stories.map((story) => (
              <li
                key={story.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <Link href={`/stories/${story.id}`}>
                  <h2 className="text-lg font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
                    {story.title}
                  </h2>
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  by{" "}
                  <Link
                    href={`/${story.author_handle ?? story.author_id}`}
                    className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {story.author ?? "Unknown"}
                  </Link>
                </p>
                {story.genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
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
                <Link href={`/stories/${story.id}`}>
                  <p className="mt-3 line-clamp-4 text-zinc-700 dark:text-zinc-300">{story.summary}</p>
                </Link>
                <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500">
                  <span>👍 {story.likes}</span>
                  <span>👎 {story.dislikes}</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    🔥 {story.interests}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
