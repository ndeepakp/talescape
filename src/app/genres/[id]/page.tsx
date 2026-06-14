import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Story = {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  author_id: string;
};

export default async function GenrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const genreId = Number(id);
  if (!Number.isInteger(genreId)) notFound();

  const [genre] = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres WHERE id = ${genreId}
  `;
  if (!genre) notFound();

  const stories = await sql<Story[]>`
    SELECT s.id, s.title, s.summary, u.name AS author, u.id AS author_id
    FROM stories s
    JOIN story_genres sg ON sg.story_id = s.id
    JOIN "user" u ON u.id = s.author_id
    WHERE sg.genre_id = ${genreId} AND s.status = 'published'
    ORDER BY s.created_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {genre.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
        </p>

        {stories.length === 0 ? (
          <p className="mt-12 text-center text-zinc-500">
            No stories in {genre.name} yet.
          </p>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stories/${s.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {s.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">by {s.author ?? "Unknown"}</p>
                  <p className="mt-2 line-clamp-4 text-zinc-700 dark:text-zinc-300">{s.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
