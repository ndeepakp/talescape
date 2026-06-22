import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BookCover } from "@/components/story/BookCover";
import { type CoverStyle } from "@/lib/cover-style";

export const dynamic = "force-dynamic";

type LibraryStory = {
  id: string;
  slug: string | null;
  title: string;
  author: string | null;
  author_handle: string | null;
  cover_url: string | null;
  cover_style: CoverStyle | null;
  chapter_index: number;
  chapter_count: number;
  has_new: boolean;
};

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const me = session.user.id;

  // Everything the reader has opened (others' published stories), newest first.
  // `has_new` is an unseen "new chapter" notification for that story — the same
  // signal the serial loop emits when an author drops a chapter.
  const stories = await sql<LibraryStory[]>`
    SELECT
      s.id, s.slug, s.title,
      u.name AS author, u.username AS author_handle,
      s.cover_url, s.cover_style,
      rp.chapter_index,
      jsonb_array_length(s.chapters)::int AS chapter_count,
      EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = ${me} AND n.kind = 'new_chapter'
          AND n.story_id = s.id AND NOT n.seen
      ) AS has_new
    FROM reading_progress rp
    JOIN stories s ON s.id = rp.story_id
    JOIN "user" u ON u.id = s.author_id
    WHERE rp.user_id = ${me}
      AND s.status = 'published'
      AND s.author_id <> ${me}
    ORDER BY rp.updated_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Your library
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick up where you left off — and see when a new chapter drops.
        </p>

        {stories.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">
            Nothing here yet.{" "}
            <Link href="/feed" className="underline">
              Find a story
            </Link>{" "}
            to start reading.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-5">
            {stories.map((s) => {
              const done = Math.min(s.chapter_index + 1, s.chapter_count);
              const pct = s.chapter_count > 0 ? (done / s.chapter_count) * 100 : 0;
              return (
                <Link
                  key={s.id}
                  href={`/stories/${s.slug ?? s.id}?chapter=${s.chapter_index}`}
                  className="group relative block"
                  title={s.title}
                >
                  <BookCover
                    title={s.title}
                    author={s.author}
                    coverUrl={s.cover_url}
                    coverStyle={s.cover_style}
                    className="aspect-[2/3] w-full rounded-md shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-md"
                  />
                  {s.has_new && (
                    <span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow">
                      ✨ New
                    </span>
                  )}
                  {/* Progress revealed on hover */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <p className="truncate text-[11px] font-semibold text-white">
                      {s.title}
                    </p>
                    <p className="text-[10px] text-white/80">
                      {s.chapter_count > 0
                        ? `Chapter ${done} / ${s.chapter_count}`
                        : "No chapters yet"}
                    </p>
                    {s.chapter_count > 0 && (
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/30">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
