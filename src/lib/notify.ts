import { sql } from "./db";

export type NotificationKind =
  | "purchase"
  | "follow"
  | "comment"
  | "subscribe"
  | "reaction"
  | "sub_expiring"
  | "new_chapter";

// Records a notification for `userId` (the recipient). Skips self-notifications
// (e.g. commenting on your own story). Never throws into the caller's flow — a
// failed notification must not break the action that triggered it.
export async function notify(opts: {
  userId: string;
  kind: NotificationKind;
  actorId?: string;
  storyId?: string;
  data?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (opts.actorId && opts.actorId === opts.userId) return;
  try {
    await sql`
      INSERT INTO notifications (user_id, kind, actor_id, story_id, data)
      VALUES (
        ${opts.userId}, ${opts.kind}, ${opts.actorId ?? null},
        ${opts.storyId ?? null}, ${sql.json(opts.data ?? {})}
      )
    `;
  } catch {
    // Swallow — notifications are best-effort.
  }
}
