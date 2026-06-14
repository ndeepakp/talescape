import Link from "next/link";
import { CURRENCY } from "@/lib/pricing";

export type Notification = {
  id: string;
  kind:
    | "purchase"
    | "follow"
    | "comment"
    | "subscribe"
    | "reaction"
    | "sub_expiring"
    | "new_chapter";
  actor_id: string | null;
  actor_name: string | null;
  actor_handle: string | null;
  story_id: string | null;
  story_title: string | null;
  data: {
    whole?: boolean;
    units?: number;
    total?: number;
    amount?: number;
    snippet?: string;
    value?: number;
    days_left?: number;
  };
  seen: boolean;
  created_at: string;
};

function Actor({ n }: { n: Notification }) {
  if (n.actor_id) {
    return (
      <Link
        href={`/${n.actor_handle ?? n.actor_id}`}
        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
      >
        {n.actor_name ?? "A reader"}
      </Link>
    );
  }
  return <span className="font-medium text-zinc-900 dark:text-zinc-100">Someone</span>;
}

function Story({ n }: { n: Notification }) {
  if (n.story_id) {
    return (
      <Link
        href={`/stories/${n.story_id}`}
        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
      >
        {n.story_title ?? "a story"}
      </Link>
    );
  }
  return <>your story</>;
}

// Renders the inline message for one notification. Plain component (no client
// hooks) so it can be used by both the bell (client) and the page (server).
export function NotificationMessage({ n }: { n: Notification }) {
  const d = n.data ?? {};

  switch (n.kind) {
    case "purchase":
      return (
        <>
          <Actor n={n} /> bought{" "}
          {d.whole ? "the whole story" : `${d.units ?? 0} chapter${d.units === 1 ? "" : "s"}`} of{" "}
          <Story n={n} />
          {d.total ? ` · ${CURRENCY}${d.total}` : ""}.
        </>
      );
    case "follow":
      return (
        <>
          <Actor n={n} /> started following you.
        </>
      );
    case "comment":
      return (
        <>
          <Actor n={n} /> commented on <Story n={n} />
          {d.snippet ? `: “${d.snippet}”` : ""}.
        </>
      );
    case "subscribe":
      return (
        <>
          <Actor n={n} /> subscribed to you
          {d.amount ? ` · ${CURRENCY}${d.amount}` : ""}.
        </>
      );
    case "reaction":
      return (
        <>
          <Actor n={n} /> {d.value === -1 ? "disliked" : "liked"} <Story n={n} />.
        </>
      );
    case "new_chapter":
      return (
        <>
          <Actor n={n} /> added a new chapter to <Story n={n} />.
        </>
      );
    case "sub_expiring":
      return (
        <>
          Your subscription to <Actor n={n} /> ends{" "}
          {typeof d.days_left === "number"
            ? d.days_left <= 1
              ? "within a day"
              : `in ${d.days_left} days`
            : "soon"}
          . Renew to keep access.
        </>
      );
    default:
      return null;
  }
}
