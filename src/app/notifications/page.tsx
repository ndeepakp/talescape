import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  NotificationMessage,
  type Notification,
} from "@/components/NotificationMessage";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const me = session.user.id;

  // Viewing the list reads everything — clear the unread state.
  await sql`
    UPDATE notifications SET seen = true
    WHERE user_id = ${me} AND seen = false
  `;

  const items = await sql<Notification[]>`
    SELECT
      n.id, n.kind, n.actor_id, a.name AS actor_name, a.username AS actor_handle,
      n.story_id, s.title AS story_title, n.data, n.seen, n.created_at
    FROM notifications n
    LEFT JOIN "user" a ON a.id = n.actor_id
    LEFT JOIN stories s ON s.id = n.story_id
    WHERE n.user_id = ${me}
    ORDER BY n.created_at DESC
    LIMIT 200
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Purchases, followers, comments and subscriptions.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">No notifications yet.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={
                  "rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800 " +
                  (n.seen
                    ? "bg-white dark:bg-zinc-950"
                    : "bg-zinc-100 dark:bg-zinc-800/50")
                }
              >
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <NotificationMessage n={n} />
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
