import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { StoryForm } from "@/app/write/StoryForm";
import { type Chapter } from "@/lib/story-validation";
import { type CoverStyle } from "@/lib/cover-style";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [story] = await sql<
    {
      id: string;
      title: string;
      summary: string;
      chapters: Chapter[];
      status: "draft" | "published";
      chapters_public: boolean;
      offered_durations: ("1h" | "1d" | "1w" | "1y" | "always")[];
      whole_prices: Record<string, number>;
      currency: string;
      cover_url: string | null;
      cover_style: CoverStyle | null;
      author_id: string;
      draft_of: string | null;
    }[]
  >`
    SELECT id, title, summary, chapters, status, chapters_public,
           offered_durations, whole_prices, currency, cover_url, cover_style,
           author_id, draft_of
    FROM stories WHERE id = ${id}
  `;

  if (!story) notFound();
  // Only the author may edit; everyone else is bounced to the story page.
  if (story.author_id !== session.user.id) redirect(`/stories/${id}`);

  // A published story is edited through a separate "working copy" draft so it
  // never leaves the shelf. If one already exists, resume it; otherwise the
  // form creates it on first save. A working copy publishes back to its origin.
  let originId: string | null = story.draft_of;
  if (story.status === "published") {
    const [wip] = await sql<{ id: string }[]>`
      SELECT id FROM stories WHERE draft_of = ${id} AND author_id = ${session.user.id}
    `;
    if (wip) redirect(`/stories/${wip.id}/edit`);
    originId = id; // edit the live story; a working copy is created on save
  }

  const genreRows = await sql<{ genre_id: number }[]>`
    SELECT genre_id FROM story_genres WHERE story_id = ${id}
  `;

  const genres = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres ORDER BY name
  `;

  return (
    <StoryForm
      genres={genres}
      story={{
        id: story.id,
        title: story.title,
        summary: story.summary,
        chapters: story.chapters,
        genreIds: genreRows.map((g) => g.genre_id),
        status: story.status,
        chaptersPublic: story.chapters_public,
        offeredDurations: story.offered_durations,
        wholePrices: story.whole_prices,
        currency: story.currency,
        coverUrl: story.cover_url,
        coverStyle: story.cover_style,
        originId,
      }}
    />
  );
}
