import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { processWallpaper } from "@/lib/image";
import {
  WALLPAPER_DIR,
  WALLPAPER_PUBLIC_PREFIX,
  deleteWallpaperByUrl,
} from "@/lib/wallpaper";

export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();
  const userId = session.user.id;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "No image was uploaded.");
  }

  // Validate + sanitise (decodes, strips metadata, re-encodes to WebP).
  const { buffer, ext } = await processWallpaper(file);

  // Look up any existing wallpaper so we can delete it after the new one lands.
  const [existing] = await sql<{ feed_wallpaper: string | null }[]>`
    SELECT feed_wallpaper FROM "user" WHERE id = ${userId}
  `;

  await mkdir(WALLPAPER_DIR, { recursive: true });
  const filename = `${userId}-${Date.now()}.${ext}`;
  await writeFile(path.join(WALLPAPER_DIR, filename), buffer);

  const url = `${WALLPAPER_PUBLIC_PREFIX}/${filename}`;
  await sql`UPDATE "user" SET feed_wallpaper = ${url} WHERE id = ${userId}`;

  await deleteWallpaperByUrl(existing?.feed_wallpaper ?? null);

  return NextResponse.json({ url });
});

export const DELETE = withErrors(async () => {
  const session = await requireSession();
  const userId = session.user.id;

  const [existing] = await sql<{ feed_wallpaper: string | null }[]>`
    SELECT feed_wallpaper FROM "user" WHERE id = ${userId}
  `;

  await sql`UPDATE "user" SET feed_wallpaper = NULL WHERE id = ${userId}`;
  await deleteWallpaperByUrl(existing?.feed_wallpaper ?? null);

  return NextResponse.json({ ok: true });
});
