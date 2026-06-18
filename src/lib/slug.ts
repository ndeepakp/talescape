import { sql } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

// A URL-safe slug from a story title: lowercase, words joined by hyphens,
// trimmed to a sane length. Falls back to "story" for titles with no usable
// characters (e.g. all punctuation or non-Latin scripts the index can't hold).
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "story";
}

// A slug for `title` that no other story already uses. Appends -2, -3, … on
// collision. Pass `excludeId` when re-slugging an existing story so it doesn't
// collide with itself.
export async function uniqueStorySlug(
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title);
  const rows = await sql<{ slug: string }[]>`
    SELECT slug FROM stories
    WHERE (slug = ${base} OR slug LIKE ${base + "-%"})
      ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
  `;
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Resolve a route param (slug OR legacy uuid) to a story's id and canonical
// slug. Returns null when no story matches.
export async function resolveStory(
  param: string,
): Promise<{ id: string; slug: string | null } | null> {
  const [row] = await sql<{ id: string; slug: string | null }[]>`
    SELECT id, slug FROM stories
    WHERE ${isUuid(param) ? sql`id = ${param}` : sql`slug = ${param}`}
  `;
  return row ?? null;
}
