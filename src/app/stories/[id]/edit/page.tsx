import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { StoryForm } from "@/app/write/StoryForm";
import { type Chapter } from "@/lib/story-validation";

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
      author_id: string;
    }[]
  >`
    SELECT id, title, summary, chapters, status, chapters_public,
           offered_durations, whole_prices, author_id
    FROM stories WHERE id = ${id}
  `;

  if (!story) notFound();
  // Only the author may edit; everyone else is bounced to the story page.
  if (story.author_id !== session.user.id) redirect(`/stories/${id}`);

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
      }}
    />
  );
}
