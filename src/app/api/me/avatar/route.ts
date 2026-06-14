import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { processAvatar } from "@/lib/image";
import { AVATAR_DIR, AVATAR_PUBLIC_PREFIX, deleteAvatarByUrl } from "@/lib/avatar";

export const POST = withErrors(async (req: Request) => {
  const session = await requireSession();
  const userId = session.user.id;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "No image was uploaded.");
  }

  const { buffer, ext } = await processAvatar(file);

  const [existing] = await sql<{ image: string | null }[]>`
    SELECT image FROM "user" WHERE id = ${userId}
  `;

  await mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${userId}-${Date.now()}.${ext}`;
  await writeFile(path.join(AVATAR_DIR, filename), buffer);

  const url = `${AVATAR_PUBLIC_PREFIX}/${filename}`;
  await sql`UPDATE "user" SET image = ${url} WHERE id = ${userId}`;

  // Only clean up the previous file if it was one of ours (not an external URL).
  await deleteAvatarByUrl(existing?.image ?? null);

  return NextResponse.json({ url });
});

export const DELETE = withErrors(async () => {
  const session = await requireSession();
  const userId = session.user.id;

  const [existing] = await sql<{ image: string | null }[]>`
    SELECT image FROM "user" WHERE id = ${userId}
  `;
  await sql`UPDATE "user" SET image = NULL WHERE id = ${userId}`;
  await deleteAvatarByUrl(existing?.image ?? null);

  return NextResponse.json({ ok: true });
});
