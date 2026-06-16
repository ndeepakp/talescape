import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { processCover } from "@/lib/image";
import { COVER_DIR, COVER_PUBLIC_PREFIX } from "@/lib/cover";

// Uploads a story cover image and returns its public URL. The author uploads
// here from the write form (before the story is saved); the returned URL is sent
// as `coverUrl` when creating/editing the story.
export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "No image was uploaded.");
  }

  const { buffer, ext } = await processCover(file);

  await mkdir(COVER_DIR, { recursive: true });
  const filename = `${session.user.id}-${Date.now()}.${ext}`;
  await writeFile(path.join(COVER_DIR, filename), buffer);

  return NextResponse.json({ url: `${COVER_PUBLIC_PREFIX}/${filename}` });
});
