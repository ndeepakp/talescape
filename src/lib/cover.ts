import { unlink } from "fs/promises";
import path from "path";

// Where story cover images live on disk and how they're served.
export const COVER_DIR = path.join(process.cwd(), "public", "uploads", "covers");
export const COVER_PUBLIC_PREFIX = "/uploads/covers";

// Remove one stored cover by its public URL (best effort). Guarded by the public
// prefix so a stored value can never point outside the covers folder.
export async function deleteCoverByUrl(url: string | null) {
  if (!url || !url.startsWith(COVER_PUBLIC_PREFIX)) return;
  try {
    await unlink(path.join(COVER_DIR, path.basename(url)));
  } catch {
    // already gone — ignore
  }
}
