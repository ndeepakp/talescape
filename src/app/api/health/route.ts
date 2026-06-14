import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const [{ version }] = await sql`SELECT version()`;
    const ext = await sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
    return NextResponse.json({
      ok: true,
      postgres: version,
      pgvector: ext[0]?.extversion ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
