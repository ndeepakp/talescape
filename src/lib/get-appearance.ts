import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  DEFAULT_APPEARANCE,
  isAccent,
  isBackground,
  isThemeMode,
  type Appearance,
} from "@/lib/appearance";

// Reads the logged-in user's saved appearance preferences. Falls back to the
// defaults (which reproduce the original look) for signed-out visitors or any
// stored value that doesn't match a known option. Server-only — used by the
// root layout (no flash), the settings page, and the feed (for the wallpaper).
//
// Pass an already-resolved `session` (a page usually has one) to avoid a second
// session lookup; omit it and we'll fetch one ourselves (e.g. from the layout).
export async function getAppearance(
  session?: { user: { id: string } } | null,
): Promise<Appearance> {
  const resolved =
    session ?? (await auth.api.getSession({ headers: await headers() }));
  if (!resolved) return DEFAULT_APPEARANCE;

  const [row] = await sql<
    {
      theme_mode: string;
      accent_color: string;
      background_preset: string;
      feed_wallpaper: string | null;
    }[]
  >`
    SELECT theme_mode, accent_color, background_preset, feed_wallpaper
    FROM "user" WHERE id = ${resolved.user.id}
  `;
  if (!row) return DEFAULT_APPEARANCE;

  return {
    themeMode: isThemeMode(row.theme_mode) ? row.theme_mode : DEFAULT_APPEARANCE.themeMode,
    accent: isAccent(row.accent_color) ? row.accent_color : DEFAULT_APPEARANCE.accent,
    background: isBackground(row.background_preset)
      ? row.background_preset
      : DEFAULT_APPEARANCE.background,
    feedWallpaper: typeof row.feed_wallpaper === "string" ? row.feed_wallpaper : null,
  };
}
