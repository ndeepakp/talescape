import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DeleteStoryButton } from "@/components/DeleteStoryButton";

export const dynamic = "force-dynamic";

function expiryLabel(expires: string | null): string {
  if (!expires) return "";
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "Expires in 1 day" : `Expires in ${days} days`;
}

export default async function DraftsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const me = session.user.id;

  // Drafts live for 7 days from their last save — clean up any that have
  // lapsed, then show what remains.
  await sql`
    DELETE FROM stories
    WHERE author_id = ${me} AND status = 'draft'
      AND draft_expires_at IS NOT NULL AND draft_expires_at <= now()
  `;

  const drafts = await sql<
    {
      id: string;
      title: string;
      summary: string;
      draft_expires_at: string | null;
      draft_of: string | null;
    }[]
  >`
    SELECT id, title, summary, draft_expires_at, draft_of
    FROM stories
    WHERE author_id = ${me} AND status = 'draft'
    ORDER BY created_at DESC
  `;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Your drafts
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Drafts are private to you and are kept for 7 days from each save.
        </p>

        {drafts.length === 0 ? (
          <p className="mt-10 text-center text-zinc-500">
            No drafts right now.{" "}
            <Link href="/write" className="underline">
              Start writing
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/stories/${d.id}/edit`} className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
                      {d.title || "Untitled"}
                    </h2>
                  </Link>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    {expiryLabel(d.draft_expires_at)}
                  </span>
                </div>
                {d.draft_of && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    ✏️ Unpublished edits — your published version stays live
                  </p>
                )}
                {d.summary && (
                  <Link href={`/stories/${d.id}/edit`} className="block">
                    <p className="mt-2 line-clamp-3 text-zinc-700 dark:text-zinc-300">
                      {d.summary}
                    </p>
                  </Link>
                )}
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    href={`/stories/${d.id}/edit`}
                    className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
                  >
                    Continue editing
                  </Link>
                  <DeleteStoryButton storyId={d.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
