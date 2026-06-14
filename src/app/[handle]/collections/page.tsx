import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HandleCollectionsPage({
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
  const h = user.username ?? handle;
  const isSelf = session.user.id === user.id;

  const collections = await sql<{ id: string; name: string; count: number }[]>`
    SELECT c.id, c.name, COUNT(cs.story_id)::int AS count
    FROM collections c
    LEFT JOIN collection_stories cs ON cs.collection_id = c.id
    WHERE c.user_id = ${user.id}
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {isSelf ? "Your collections" : `${user.name ?? "Reader"}'s collections`}
        </h1>
        {isSelf && (
          <p className="mt-1 text-sm text-zinc-500">
            Create a collection from any story&apos;s “Save to collection” button.
          </p>
        )}

        {collections.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">No collections yet.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {collections.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${h}/collections/${c.id}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {c.name}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {c.count} {c.count === 1 ? "story" : "stories"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
