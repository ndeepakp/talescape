import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DeleteCollectionButton } from "@/components/collections/DeleteCollectionButton";
import { ShareCollection } from "@/components/collections/ShareCollection";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string; id: string }>;
}) {
  const { handle, id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // The collection must belong to the handle in the URL. Viewable by anyone with
  // the link; only the owner gets the management controls.
  const [collection] = await sql<
    { id: string; name: string; user_id: string; owner: string | null }[]
  >`
    SELECT c.id, c.name, c.user_id, u.name AS owner
    FROM collections c JOIN "user" u ON u.id = c.user_id
    WHERE c.id = ${id} AND lower(u.username) = lower(${handle})
  `;
  if (!collection) notFound();
  const isOwner = collection.user_id === session.user.id;

  const me = session.user.id;
  const stories = await sql<
    { id: string; title: string; author: string | null; author_id: string; accessible: boolean }[]
  >`
    SELECT s.id, s.title, u.name AS author, s.author_id,
      (
        s.author_id = ${me}
        OR s.chapters_public
        OR EXISTS (
          SELECT 1 FROM access_grants ag
          WHERE ag.story_id = s.id AND ag.user_id = ${me}
            AND (ag.expires_at IS NULL OR ag.expires_at > now())
        )
        OR EXISTS (
          SELECT 1 FROM subscriptions sub
          WHERE sub.subscriber_id = ${me} AND sub.author_id = s.author_id
            AND sub.expires_at > now()
        )
      ) AS accessible
    FROM collection_stories cs
    JOIN stories s ON s.id = cs.story_id
    JOIN "user" u ON u.id = s.author_id
    WHERE cs.collection_id = ${id} AND s.status = 'published'
    ORDER BY cs.added_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {collection.name}
            </h1>
            {!isOwner && (
              <p className="mt-0.5 text-sm text-zinc-500">
                a collection by {collection.owner ?? "a reader"}
              </p>
            )}
          </div>
          {isOwner && <DeleteCollectionButton collectionId={collection.id} />}
        </div>
        <div className="mt-3">
          <ShareCollection name={collection.name} />
        </div>

        {stories.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">
            Nothing here yet — save stories to this collection from their page.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-zinc-500">
              Titles and authors are visible to everyone. You can read a story
              only if you have access to it or subscribe to its author.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {stories.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/stories/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {s.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        by{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {s.author ?? "Unknown"}
                        </span>
                      </p>
                    </div>
                    {s.accessible ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        Read
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        🔒 Buy or subscribe
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
