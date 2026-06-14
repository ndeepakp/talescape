import { readdir, unlink } from "fs/promises";
import path from "path";

// Single source of truth for where feed wallpapers live on disk and how they're
// served. Both the upload route and the account-deletion hook import these so
// the path logic is never duplicated (and never drifts out of sync).
export const WALLPAPER_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "feed-wallpapers",
);
export const WALLPAPER_PUBLIC_PREFIX = "/uploads/feed-wallpapers";

// Remove one stored wallpaper file given its public URL (best effort). Guarded
// by the public prefix + basename so a stored value can never point outside the
// wallpaper folder.
export async function deleteWallpaperByUrl(url: string | null) {
  if (!url || !url.startsWith(WALLPAPER_PUBLIC_PREFIX)) return;
  const filename = path.basename(url);
  try {
    await unlink(path.join(WALLPAPER_DIR, filename));
  } catch {
    // File may already be gone — ignore.
  }
}

// Remove every wallpaper file belonging to a user. Used when their account is
// deleted, so nothing is left orphaned on disk. Files are named
// `${userId}-${timestamp}.webp`, so we match the `${userId}-` prefix — the
// trailing hyphen prevents one user's id from matching another whose id merely
// starts with the same characters.
export async function deleteWallpapersForUser(userId: string) {
  let entries: string[];
  try {
    entries = await readdir(WALLPAPER_DIR);
  } catch {
    // Folder doesn't exist yet — nothing to clean up.
    return;
  }
  const prefix = `${userId}-`;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) =>
        unlink(path.join(WALLPAPER_DIR, name)).catch(() => {
          // Already gone — ignore.
        }),
      ),
  );
}
