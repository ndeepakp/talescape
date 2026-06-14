import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { FollowButton } from "@/components/FollowButton";
import { Avatar } from "@/components/Avatar";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ReportButton } from "@/components/ReportButton";
import { CURRENCY } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [user] = await sql<
    {
      id: string;
      name: string | null;
      username: string | null;
      bio: string | null;
      about: string | null;
      subscription_price: number | null;
      image: string | null;
    }[]
  >`
    SELECT id, name, username, bio, about, subscription_price, image
    FROM "user" WHERE lower(username) = lower(${handle})
  `;
  if (!user) notFound();

  const id = user.id;
  const h = user.username ?? handle;
  const isSelf = session.user.id === id;

  // The viewer's active subscription to this author (days remaining + whether
  // they've cancelled future renewal), if any.
  let subDaysLeft: number | null = null;
  let subCancelled = false;
  if (!isSelf && user.subscription_price) {
    const [row] = await sql<{ days: number; cancelled: boolean }[]>`
      SELECT CEIL(EXTRACT(EPOCH FROM (expires_at - now())) / 86400)::int AS days,
             cancelled
      FROM subscriptions
      WHERE subscriber_id = ${session.user.id} AND author_id = ${id}
        AND expires_at > now()
    `;
    subDaysLeft = row?.days ?? null;
    subCancelled = row?.cancelled ?? false;
  }

  // For the author themselves: how many readers currently subscribe to them.
  let subscriberCount = 0;
  if (isSelf) {
    const [row] = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM subscriptions
      WHERE author_id = ${id} AND expires_at > now()
    `;
    subscriberCount = row?.c ?? 0;
  }

  const [{ followers }] = await sql<{ followers: number }[]>`
    SELECT COUNT(*)::int AS followers FROM follows WHERE following_id = ${id}
  `;
  const [{ following }] = await sql<{ following: number }[]>`
    SELECT COUNT(*)::int AS following FROM follows WHERE follower_id = ${id}
  `;

  // Public, published stories — what every visitor sees.
  const stories = await sql<
    {
      id: string;
      title: string;
      summary: string;
      created_at: string;
    }[]
  >`
    SELECT id, title, summary, created_at
    FROM stories
    WHERE author_id = ${id} AND status = 'published'
    ORDER BY created_at DESC
  `;

  // The author's own private drafts — shown only to them.
  const drafts = isSelf
    ? await sql<{ id: string; title: string; summary: string }[]>`
        SELECT id, title, summary
        FROM stories
        WHERE author_id = ${id} AND status = 'draft'
          AND (draft_expires_at IS NULL OR draft_expires_at > now())
        ORDER BY created_at DESC
      `
    : [];

  let isFollowing = false;
  if (session && !isSelf) {
    const [row] = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM follows WHERE follower_id = ${session.user.id} AND following_id = ${id}
    `;
    isFollowing = !!row;
  }

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar src={user.image} name={user.name} size={64} />
            <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {user.name ?? "Unknown writer"}
            </h1>
            {user.username && (
              <p className="mt-1 text-sm font-medium text-zinc-500">${user.username}</p>
            )}
            {user.bio && (
              <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {user.bio}
              </p>
            )}
            <div className="mt-3 flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href={`/${h}/stories`} className="hover:underline">
                <strong className="text-zinc-900 dark:text-zinc-100">{stories.length}</strong> stories
              </Link>
              <Link href={`/${h}/connections?tab=followers`} className="hover:underline">
                <strong className="text-zinc-900 dark:text-zinc-100">{followers}</strong> followers
              </Link>
              <Link href={`/${h}/connections?tab=following`} className="hover:underline">
                <strong className="text-zinc-900 dark:text-zinc-100">{following}</strong> following
              </Link>
            </div>
            {isSelf && (
              <p className="mt-2 text-sm text-zinc-500">
                {user.subscription_price ? (
                  <>
                    Subscription:{" "}
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {CURRENCY}
                      {user.subscription_price}
                    </strong>{" "}
                    / 30 days · {subscriberCount}{" "}
                    {subscriberCount === 1 ? "subscriber" : "subscribers"}
                  </>
                ) : (
                  <>
                    No subscription set —{" "}
                    <Link href={`/${h}/edit`} className="underline">
                      add one
                    </Link>{" "}
                    so readers can subscribe.
                  </>
                )}
              </p>
            )}
            </div>
          </div>
          {isSelf ? (
            <Link
              href={`/${h}/edit`}
              className="flex h-11 shrink-0 items-center rounded-full btn-primary px-5 text-sm font-medium transition-colors"
            >
              Edit profile
            </Link>
          ) : (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <FollowButton
                userId={user.id}
                initialFollowing={isFollowing}
                isLoggedIn={!!session}
              />
              {user.subscription_price ? (
                <SubscribeButton
                  authorId={user.id}
                  price={user.subscription_price}
                  initialDaysLeft={subDaysLeft}
                  initialCancelled={subCancelled}
                />
              ) : null}
            </div>
          )}
        </div>

        {isSelf && <AnalyticsPanel />}

        {user.about && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              About
            </h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">
              {user.about}
            </p>
          </section>
        )}

        <h2 className="mt-10 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Stories
        </h2>
        {stories.length === 0 ? (
          <p className="mt-4 text-zinc-500">No stories yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {stories.map((story) => (
              <li key={story.id}>
                <Link
                  href={`/stories/${story.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {story.title}
                  </h3>
                  <p className="mt-2 line-clamp-4 text-zinc-700 dark:text-zinc-300">{story.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {isSelf && drafts.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Drafts{" "}
              <span className="text-sm font-normal text-zinc-500">
                (only you can see these)
              </span>
            </h2>
            <ul className="mt-4 flex flex-col gap-4">
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <Link
                    href={`/stories/${draft.id}/edit`}
                    className="block rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-5 transition-colors hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        Draft
                      </span>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {draft.title || "Untitled"}
                      </h3>
                    </div>
                    {draft.summary && (
                      <p className="mt-2 line-clamp-3 text-zinc-700 dark:text-zinc-300">
                        {draft.summary}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {!isSelf && (
          <div className="mt-12 flex flex-col items-start gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <ReportButton userId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
