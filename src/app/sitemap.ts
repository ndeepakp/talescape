import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";

const BASE = "https://talerooms.fly.dev";

export const dynamic = "force-dynamic";

// Lists the home page plus every published story so search engines can find and
// index them. Author profiles could be added here later.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let stories: { slug: string | null; id: string; created_at: string }[] = [];
  let authors: { username: string }[] = [];
  try {
    stories = await sql<{ slug: string | null; id: string; created_at: string }[]>`
      SELECT slug, id, created_at FROM stories
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT 5000
    `;
    // Authors who have at least one published story (their profiles are worth
    // indexing).
    authors = await sql<{ username: string }[]>`
      SELECT DISTINCT u.username FROM "user" u
      JOIN stories s ON s.author_id = u.id AND s.status = 'published'
      WHERE u.username IS NOT NULL
      LIMIT 5000
    `;
  } catch {
    stories = [];
    authors = [];
  }

  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    ...stories.map((s) => ({
      url: `${BASE}/stories/${s.slug ?? s.id}`,
      lastModified: new Date(s.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...authors.map((a) => ({
      url: `${BASE}/${a.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
