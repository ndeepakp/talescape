import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/embedding";

// Dev-only helper: backfill embeddings for stories that don't have one yet.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const stories = await sql<{ id: string; title: string; body: string }[]>`
    SELECT id, title, body FROM stories WHERE embedding IS NULL
  `;

  for (const s of stories) {
    const vec = toVectorLiteral(await embed(`${s.title}\n\n${s.body}`));
    await sql`UPDATE stories SET embedding = ${vec}::vector WHERE id = ${s.id}`;
  }

  return NextResponse.json({ reindexed: stories.length });
}
