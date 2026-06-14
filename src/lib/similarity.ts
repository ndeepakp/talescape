import { sql } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/embedding";

export type Match = {
  id: string;
  title: string;
  author: string | null;
  similarity: number;
};

type ScoredRow = { id: string; title: string; author: string | null; score: number };

// Semantic: AI embedding cosine similarity — catches reworded / paraphrased stories.
// Reworded stories with renamed characters land around 0.65; unrelated stories sit
// near 0.20, so 0.6 catches near-duplicates with a wide safety margin.
const SIMILARITY_THRESHOLD = 0.6;
// Lexical: shared wording (pg_trgm) — catches near-verbatim copies even when one
// story is much shorter than the other (where the embedding signal weakens).
const OVERLAP_THRESHOLD = 0.5;

// A story id that never exists, used as a no-op when nothing should be excluded.
const NO_EXCLUDE = "00000000-0000-0000-0000-000000000000";

/**
 * Embed `combined` (title + body) and find existing stories that are too similar,
 * by either AI meaning or literal wording. Pass `excludeId` when editing a story
 * so it doesn't match itself. Returns the embedding (for saving) and the matches.
 */
export async function findSimilar(
  combined: string,
  excludeId?: string,
): Promise<{ vec: string; matches: Match[] }> {
  const vec = toVectorLiteral(await embed(combined));
  const exclude = excludeId ?? NO_EXCLUDE;

  const semanticRows = await sql<ScoredRow[]>`
    SELECT s.id, s.title, u.name AS author,
           1 - (s.embedding <=> ${vec}::vector) AS score
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    WHERE s.embedding IS NOT NULL
      AND s.id <> ${exclude}
      AND 1 - (s.embedding <=> ${vec}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY s.embedding <=> ${vec}::vector
    LIMIT 5
  `;

  const lexicalRows = await sql<ScoredRow[]>`
    SELECT s.id, s.title, u.name AS author,
           GREATEST(
             word_similarity(${combined}, s.title || ' ' || s.body),
             word_similarity(s.title || ' ' || s.body, ${combined})
           ) AS score
    FROM stories s
    JOIN "user" u ON u.id = s.author_id
    WHERE s.id <> ${exclude}
      AND GREATEST(
            word_similarity(${combined}, s.title || ' ' || s.body),
            word_similarity(s.title || ' ' || s.body, ${combined})
          ) >= ${OVERLAP_THRESHOLD}
    ORDER BY score DESC
    LIMIT 5
  `;

  const byId = new Map<string, Match>();
  for (const r of [...semanticRows, ...lexicalRows]) {
    const score = Number(r.score);
    const existing = byId.get(r.id);
    if (!existing || score > existing.similarity) {
      byId.set(r.id, { id: r.id, title: r.title, author: r.author, similarity: score });
    }
  }

  const matches = [...byId.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return { vec, matches };
}
