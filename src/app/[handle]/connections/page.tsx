import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Person = { id: string; name: string | null; username: string | null; bio: string | null };

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { handle } = await params;
  const { tab } = await searchParams;
  const showFollowing = tab === "following";

  const [user] = await sql<{ id: string; name: string | null; username: string | null }[]>`
    SELECT id, name, username FROM "user" WHERE lower(username) = lower(${handle})
  `;
  if (!user) notFound();
  const id = user.id;
  const h = user.username ?? handle;

  const people = showFollowing
    ? await sql<Person[]>`
        SELECT u.id, u.name, u.username, u.bio
        FROM follows f
        JOIN "user" u ON u.id = f.following_id
        WHERE f.follower_id = ${id}
        ORDER BY f.created_at DESC
      `
    : await sql<Person[]>`
        SELECT u.id, u.name, u.username, u.bio
        FROM follows f
        JOIN "user" u ON u.id = f.follower_id
        WHERE f.following_id = ${id}
        ORDER BY f.created_at DESC
      `;

  const tabClass = (active: boolean) =>
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
    (active
      ? "btn-primary"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900");

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {user.name ?? "Writer"}&apos;s connections
        </h1>
        <div className="mt-4 flex gap-2">
          <Link href={`/${h}/connections?tab=followers`} className={tabClass(!showFollowing)}>
            Followers
          </Link>
          <Link href={`/${h}/connections?tab=following`} className={tabClass(showFollowing)}>
            Following
          </Link>
        </div>

        {people.length === 0 ? (
          <p className="mt-12 text-center text-zinc-500">
            {showFollowing ? "Not following anyone yet." : "No followers yet."}
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {people.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${p.username ?? p.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {p.name ?? "Unknown writer"}
                  </span>
                  {p.username && (
                    <span className="ml-2 text-sm text-zinc-500">${p.username}</span>
                  )}
                  {p.bio && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {p.bio}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
