import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { isReservedHandle } from "@/lib/handles";

const MIN_GENRES = 3;
const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
const MAX_BIO = 500;
const MAX_ABOUT = 2000;

export const PUT = withErrors(async (req: Request) => {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  // Accept a handle with or without the leading "$"; we store it bare.
  const rawHandle = typeof body.username === "string" ? body.username.trim() : "";
  const username = rawHandle.startsWith("$") ? rawHandle.slice(1) : rawHandle;
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  const about = typeof body.about === "string" ? body.about.trim() : "";
  // Subscription price: a positive integer enables a paid subscription; 0 or
  // empty means the author isn't offering one.
  const rawSub = Number(body.subscriptionPrice);
  const subscriptionPrice =
    Number.isFinite(rawSub) && rawSub > 0 ? Math.floor(rawSub) : null;
  const rawIds: unknown[] = Array.isArray(body.genreIds) ? body.genreIds : [];
  const ids: number[] = [
    ...new Set(rawIds.filter((g): g is number => Number.isInteger(g))),
  ];

  if (name.length < 1) {
    throw new ApiError(400, "Please enter a display name.");
  }
  if (!HANDLE_RE.test(username)) {
    throw new ApiError(400, "Handles must be 3–20 letters, numbers, or underscores.");
  }
  if (isReservedHandle(username)) {
    throw new ApiError(400, "That handle is reserved — please choose another.");
  }
  if (bio.length > MAX_BIO) {
    throw new ApiError(400, `Status must be ${MAX_BIO} characters or fewer.`);
  }
  if (about.length > MAX_ABOUT) {
    throw new ApiError(400, `About must be ${MAX_ABOUT} characters or fewer.`);
  }
  if (ids.length < MIN_GENRES) {
    throw new ApiError(400, `Please pick at least ${MIN_GENRES} genres.`);
  }

  const userId = session.user.id;

  const [clash] = await sql<{ exists: number }[]>`
    SELECT 1 AS exists FROM "user"
    WHERE lower(username) = lower(${username}) AND id <> ${userId}
  `;
  if (clash) {
    throw new ApiError(409, `$${username} is already taken.`);
  }

  await sql`
    UPDATE "user"
    SET name = ${name}, username = ${username}, bio = ${bio || null},
        about = ${about || null}, subscription_price = ${subscriptionPrice}
    WHERE id = ${userId}
  `;

  await sql`DELETE FROM user_genres WHERE user_id = ${userId}`;
  const rows = ids.map((g: number) => ({ user_id: userId, genre_id: g }));
  await sql`INSERT INTO user_genres ${sql(rows, "user_id", "genre_id")} ON CONFLICT DO NOTHING`;

  return NextResponse.json({ ok: true });
});
