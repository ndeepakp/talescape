import sharp from "sharp";
import { ApiError } from "@/lib/http";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_DIMENSION = 2560; // cap very large uploads
const ALLOWED_INPUT = new Set(["jpeg", "png", "webp", "gif"]);

/**
 * Validates and sanitises an uploaded image. We don't trust the browser's
 * declared MIME type — instead we decode the bytes with sharp (which only
 * succeeds on a real raster image), then RE-ENCODE to WebP. Re-encoding both
 * proves the file is a genuine image and strips any embedded payload or EXIF
 * metadata (e.g. GPS location). Oversized images are scaled down.
 *
 * Throws an ApiError (400) with a user-friendly message on anything invalid.
 */
export async function processWallpaper(
  file: File,
): Promise<{ buffer: Buffer; ext: "webp" }> {
  if (file.size > MAX_BYTES) {
    throw new ApiError(400, "Image is too large. Please keep it under 8 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    // `animated: true` preserves animated GIFs as animated WebP.
    const pipeline = sharp(input, { animated: true });
    const meta = await pipeline.metadata();

    if (!meta.format || !ALLOWED_INPUT.has(meta.format)) {
      throw new ApiError(400, "Please upload a JPG, PNG, WEBP, or GIF image.");
    }

    const buffer = await pipeline
      .rotate() // auto-orient from EXIF, then drop the metadata
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return { buffer, ext: "webp" };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // sharp throws here when the bytes aren't a decodable image.
    throw new ApiError(400, "That file doesn't look like a valid image.");
  }
}

const AVATAR_SIZE = 256;

/**
 * Same validation/sanitisation as processWallpaper, but produces a square
 * cover-cropped avatar.
 */
export async function processAvatar(
  file: File,
): Promise<{ buffer: Buffer; ext: "webp" }> {
  if (file.size > MAX_BYTES) {
    throw new ApiError(400, "Image is too large. Please keep it under 8 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const pipeline = sharp(input);
    const meta = await pipeline.metadata();
    if (!meta.format || !ALLOWED_INPUT.has(meta.format)) {
      throw new ApiError(400, "Please upload a JPG, PNG, WEBP, or GIF image.");
    }
    const buffer = await pipeline
      .rotate()
      .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer, ext: "webp" };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "That file doesn't look like a valid image.");
  }
}
