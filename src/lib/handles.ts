import { sql } from "@/lib/db";

// Handles that would collide with real top-level routes. A user can't claim one
// of these (the static route would shadow it anyway).
export const RESERVED_HANDLES = new Set([
  "feed",
  "settings",
  "write",
  "drafts",
  "notifications",
  "search",
  "stories",
  "collections",
  "users",
  "genres",
  "login",
  "signup",
  "logout",
  "api",
  "icon",
  "favicon",
  "admin",
  "me",
  "new",
  "edit",
  "about",
  "help",
  "static",
  "public",
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.trim().toLowerCase());
}

// Resolves a URL handle to a user id (case-insensitive), or null if no such user.
export async function userIdByHandle(handle: string): Promise<string | null> {
  const h = handle.trim();
  if (!h) return null;
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM "user" WHERE lower(username) = lower(${h})
  `;
  return row?.id ?? null;
}

// Resolves a user id to their handle (for building handle-based URLs / redirects).
export async function handleByUserId(id: string): Promise<string | null> {
  const [row] = await sql<{ username: string | null }[]>`
    SELECT username FROM "user" WHERE id = ${id}
  `;
  return row?.username ?? null;
}
