import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";

export const dynamic = "force-dynamic";

type GenreHit = { id: number; name: string };
type UserHit = { id: string; name: string | null; username: string | null; bio: string | null };
type StoryHit = {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  author_id: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { q } = await searchParams;
  const raw = (q ?? "").trim();
  // A leading "$" means the reader is specifically after a handle.
  const handleOnly = raw.startsWith("$");
  const term = handleOnly ? raw.slice(1) : raw;

  let genres: GenreHit[] = [];
  let users: UserHit[] = [];
  let stories: StoryHit[] = [];

  if (term.length > 0) {
    const pattern = `%${term}%`;
    users = await sql<UserHit[]>`
      SELECT id, name, username, bio
      FROM "user"
      WHERE username ILIKE ${pattern}
         OR name ILIKE ${pattern}
         OR word_similarity(${term}, coalesce(name, '')) > 0.3
         OR word_similarity(${term}, coalesce(username, '')) > 0.3
      ORDER BY GREATEST(
        word_similarity(${term}, coalesce(username, '')),
        word_similarity(${term}, coalesce(name, ''))
      ) DESC
      LIMIT 10
    `;

    if (!handleOnly) {
      genres = await sql<GenreHit[]>`
        SELECT id, name FROM genres WHERE name ILIKE ${pattern} ORDER BY name LIMIT 10
      `;

      stories = await sql<StoryHit[]>`
        SELECT s.id, s.title, s.summary, u.name AS author, u.id AS author_id
        FROM stories s
        JOIN "user" u ON u.id = s.author_id
        WHERE s.status = 'published'
          AND (s.title ILIKE ${pattern} OR word_similarity(${term}, s.title) > 0.3)
        ORDER BY word_similarity(${term}, s.title) DESC, s.created_at DESC
        LIMIT 10
      `;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div>
          <SearchBar initial={raw} />
        </div>

        {term.length === 0 ? (
          <p className="mt-12 text-center text-zinc-500">
            Search for a story title, a writer&apos;s name, or a $handle.
          </p>
        ) : (
          <>
            {!handleOnly && genres.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Genres
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <Link
                      key={g.id}
                      href={`/genres/${g.id}`}
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {g.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                People
              </h2>
              {users.length === 0 ? (
                <p className="mt-3 text-zinc-500">No people found.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {users.map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/${u.username ?? u.id}`}
                        className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                      >
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {u.name ?? "Unknown writer"}
                        </span>{" "}
                        {u.username && (
                          <span className="text-sm text-zinc-500">${u.username}</span>
                        )}
                        {u.bio && (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {u.bio}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!handleOnly && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Stories
                </h2>
                {stories.length === 0 ? (
                  <p className="mt-3 text-zinc-500">No stories found.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {stories.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/stories/${s.id}`}
                          className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                        >
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {s.title}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            by {s.author ?? "Unknown"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {s.summary}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
