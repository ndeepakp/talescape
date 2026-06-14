import { readdir, unlink } from "fs/promises";
import path from "path";

// Where profile pictures live on disk and how they're served.
export const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
export const AVATAR_PUBLIC_PREFIX = "/uploads/avatars";

// Remove one stored avatar file by its public URL (best effort). Guarded by the
// public prefix so a stored value can never point outside the avatar folder.
export async function deleteAvatarByUrl(url: string | null) {
  if (!url || !url.startsWith(AVATAR_PUBLIC_PREFIX)) return;
  try {
    await unlink(path.join(AVATAR_DIR, path.basename(url)));
  } catch {
    // already gone — ignore
  }
}

// Remove every avatar file belonging to a user (named `${userId}-…`). Used on
// account deletion so nothing is left orphaned.
export async function deleteAvatarsForUser(userId: string) {
  let files: string[];
  try {
    files = await readdir(AVATAR_DIR);
  } catch {
    return;
  }
  await Promise.all(
    files
      .filter((f) => f.startsWith(`${userId}-`))
      .map((f) => unlink(path.join(AVATAR_DIR, f)).catch(() => {})),
  );
}
