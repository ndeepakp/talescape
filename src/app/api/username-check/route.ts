import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/http";
import { isReservedHandle } from "@/lib/handles";

const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

export const GET = withErrors(async (req: Request) => {
  const raw = new URL(req.url).searchParams.get("u")?.trim() ?? "";
  const username = raw.startsWith("$") ? raw.slice(1) : raw;

  if (!HANDLE_RE.test(username)) {
    return NextResponse.json({
      available: false,
      error: "Handles must be 3–20 letters, numbers, or underscores.",
    });
  }
  if (isReservedHandle(username)) {
    return NextResponse.json({ available: false, error: "That handle is reserved." });
  }

  const [taken] = await sql<{ exists: number }[]>`
    SELECT 1 AS exists FROM "user" WHERE lower(username) = lower(${username})
  `;

  return NextResponse.json({ available: !taken });
});
