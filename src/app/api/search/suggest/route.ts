import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession, withErrors } from "@/lib/http";

export const GET = withErrors(async (req: Request) => {
  await requireSession();

  const raw = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // A leading "$" means the reader is specifically after a handle.
  const handleOnly = raw.startsWith("$");
  const term = handleOnly ? raw.slice(1) : raw;

  if (term.length === 0) {
    return NextResponse.json({ genres: [], users: [], stories: [] });
  }

  // Escape LIKE wildcards so a literal "%" or "_" typed by the user is matched
  // as text rather than acting as a wildcard.
  const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const users = await sql<{ id: string; name: string | null; username: string | null }[]>`
    SELECT id, name, username
    FROM "user"
    WHERE username ILIKE ${pattern}
       OR name ILIKE ${pattern}
       OR word_similarity(${term}, coalesce(name, '')) > 0.3
       OR word_similarity(${term}, coalesce(username, '')) > 0.3
    ORDER BY GREATEST(
      word_similarity(${term}, coalesce(username, '')),
      word_similarity(${term}, coalesce(name, ''))
    ) DESC
    LIMIT 5
  `;

  if (handleOnly) {
    return NextResponse.json({ genres: [], users, stories: [] });
  }

  const genres = await sql<{ id: number; name: string }[]>`
    SELECT id, name
    FROM genres
    WHERE name ILIKE ${pattern}
    ORDER BY name
    LIMIT 5
  `;

  const stories = await sql<{ id: string; title: string; author: string | null }[]>`
    SELECT s.id, s.title, u.name AS author
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    WHERE s.status = 'published'
      AND (s.title ILIKE ${pattern} OR word_similarity(${term}, s.title) > 0.3)
    ORDER BY word_similarity(${term}, s.title) DESC, s.created_at DESC
    LIMIT 5
  `;

  return NextResponse.json({ genres, users, stories });
});
