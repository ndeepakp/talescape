import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession, withErrors } from "@/lib/http";

// Autocomplete for composing posts: matching @people and story titles.
export const GET = withErrors(async (req: Request) => {
  await requireSession();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ users: [], stories: [] });
  const like = q.replace(/[%_\\]/g, "\\$&");

  const users = await sql<{ handle: string; name: string | null; image: string | null }[]>`
    SELECT username AS handle, name, image FROM "user"
    WHERE username IS NOT NULL
      AND (username ILIKE ${like + "%"} OR name ILIKE ${"%" + like + "%"})
    ORDER BY (username ILIKE ${like + "%"}) DESC, username
    LIMIT 6
  `;

  const stories = await sql<{ id: string; slug: string | null; title: string }[]>`
    SELECT id, slug, title FROM stories
    WHERE status = 'published' AND title ILIKE ${"%" + like + "%"}
    ORDER BY title
    LIMIT 6
  `;

  return NextResponse.json({ users, stories });
});
