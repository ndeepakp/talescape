import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { FollowButton } from "@/components/profile/FollowButton";
import { Avatar } from "@/components/layout/Avatar";
import { AnalyticsPanel } from "@/components/profile/AnalyticsPanel";
import { SubscribeButton } from "@/components/profile/SubscribeButton";
import { ReportButton } from "@/components/profile/ReportButton";
import { PostsSection } from "@/components/post/PostsSection";
import { SideTabs } from "@/components/feed/SideTabs";
import { getPosts } from "@/lib/posts";
import { CURRENCY } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Public SEO + social metadata for author profiles.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const [u] = await sql<
    { name: string | null; username: string | null; bio: string | null; image: string | null }[]
  >`SELECT name, username, bio, image FROM "user" WHERE lower(username) = lower(${handle})`;
  if (!u) return { title: "Profile · Talerooms" };
  const display = u.name ?? (u.username ? `@${u.username}` : "A writer");
  const description = (u.bio || `${display} on Talerooms.`).slice(0, 200);
  const images = u.image ? [{ url: u.image }] : undefined;
  return {
    title: `${display} (@${u.username ?? handle}) · Talerooms`,
    description,
    openGraph: { title: display, description, type: "profile", images },
    twitter: {
      card: u.image ? "summary" : "summary",
      title: display,
      description,
      images: u.image ? [u.image] : undefined,
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  // Session is optional — profiles are public (indexable + shareable).
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user.id ?? null;

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
  const isSelf = userId === id;

  // The viewer's active subscription to this author (days remaining + whether
  // they've cancelled future renewal), if any.
  let subDaysLeft: number | null = null;
  let subCancelled = false;
  if (!isSelf && user.subscription_price && userId) {
    const [row] = await sql<{ days: number; cancelled: boolean }[]>`
      SELECT CEIL(EXTRACT(EPOCH FROM (expires_at - now())) / 86400)::int AS days,
             cancelled
      FROM subscriptions
      WHERE subscriber_id = ${userId} AND author_id = ${id}
        AND expires_at > now()
    `;
    subDaysLeft = row?.days ?? null;
    subCancelled = row?.cancelled ?? false;
  }

  // How many readers currently subscribe to this user — public for everyone.
  const [subRow] = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM subscriptions
    WHERE author_id = ${id} AND expires_at > now()
  `;
  const subscriberCount = subRow?.c ?? 0;

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
      slug: string | null;
      title: string;
      summary: string;
      created_at: string;
    }[]
  >`
    SELECT id, slug, title, summary, created_at
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
  if (userId && !isSelf) {
    const [row] = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM follows WHERE follower_id = ${userId} AND following_id = ${id}
    `;
    isFollowing = !!row;
  }

  // This user's community posts. An empty viewer id leaves the per-viewer flags
  // (liked/mine) false for logged-out visitors.
  const posts = await getPosts({ viewerId: userId ?? "", authorId: id });

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
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">{subscriberCount}</strong>{" "}
                {subscriberCount === 1 ? "subscriber" : "subscribers"}
              </span>
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
                    / 30 days
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
              {session && user.subscription_price ? (
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

        <div className="mt-8">
          <SideTabs
            tabs={[
              {
                key: "stories",
                label: "Stories",
                icon: "📚",
                content: (
                  <>
                    {stories.length === 0 ? (
                      <p className="text-zinc-500">No stories yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-4">
                        {stories.map((story) => (
                          <li key={story.id}>
                            <Link
                              href={`/stories/${story.slug ?? story.id}`}
                              className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                            >
                              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                {story.title}
                              </h3>
                              <p className="mt-2 line-clamp-4 text-zinc-700 dark:text-zinc-300">
                                {story.summary}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {isSelf && drafts.length > 0 && (
                      <>
                        <h3 className="mt-8 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                          Drafts{" "}
                          <span className="text-sm font-normal text-zinc-500">
                            (only you can see these)
                          </span>
                        </h3>
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
                                  <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                    {draft.title || "Untitled"}
                                  </h4>
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
                  </>
                ),
              },
              {
                key: "posts",
                label: "Posts",
                icon: "💬",
                content: (
                  <PostsSection
                    posts={posts}
                    emptyText={isSelf ? "You haven't posted yet." : "No posts yet."}
                  />
                ),
              },
            ]}
          />
        </div>

        {session && !isSelf && (
          <div className="mt-12 flex flex-col items-start gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <ReportButton userId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
