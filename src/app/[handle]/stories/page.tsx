import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HandleStoriesPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [user] = await sql<{ id: string; name: string | null; username: string | null }[]>`
    SELECT id, name, username FROM "user" WHERE lower(username) = lower(${handle})
  `;
  if (!user) notFound();

  const stories = await sql<
    { id: string; title: string; summary: string }[]
  >`
    SELECT id, title, summary
    FROM stories
    WHERE author_id = ${user.id} AND status = 'published'
    ORDER BY created_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Stories by {user.name ?? "this writer"}
        </h1>
        <Link
          href={`/${user.username ?? handle}`}
          className="mt-1 inline-block text-sm text-zinc-500 hover:underline"
        >
          ${user.username}
        </Link>

        {stories.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">No stories yet.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stories/${s.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {s.title}
                  </h2>
                  <p className="mt-2 line-clamp-4 text-zinc-700 dark:text-zinc-300">
                    {s.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
