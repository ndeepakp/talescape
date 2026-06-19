import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { ApiError, requireSession, withErrors } from "@/lib/http";
import { parseDocx, sanitizeImportedHtml } from "@/lib/docx-import";
import { MAX_SUMMARY_WORDS, MAX_TITLE_WORDS, wordCount } from "@/lib/story-validation";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Convert an uploaded Word .docx into a story title + chapters for the editor.
// Nothing is saved here — the parsed result is returned for the author to
// review (and price) in the write form before publishing.
export const POST = withErrors(async (req: Request) => {
  await requireSession();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Please choose a .docx file.");
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new ApiError(400, "Only Word .docx files are supported.");
  }
  if (file.size === 0) throw new ApiError(400, "That file is empty.");
  if (file.size > MAX_BYTES) {
    throw new ApiError(400, "That document is too large (max 5 MB).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } catch {
    throw new ApiError(400, "Couldn't read that document — make sure it's a valid .docx.");
  }

  // The file name becomes the title — enforce the title word limit up front.
  const title = file.name.replace(/\.docx$/i, "").trim();
  if (!title) {
    throw new ApiError(400, "Please give the file a name — it becomes the story’s title.");
  }
  if (wordCount(title) > MAX_TITLE_WORDS) {
    throw new ApiError(
      400,
      `The file name is too long for a title (${wordCount(title)} words). A title must be ${MAX_TITLE_WORDS} words or fewer — please rename the file and try again.`,
    );
  }

  const { summary, chapters } = parseDocx(sanitizeImportedHtml(html));
  if (chapters.length === 0) {
    throw new ApiError(400, "No readable text was found in that document.");
  }

  // The text before the first heading becomes the summary — enforce its limit.
  if (summary && wordCount(summary) > MAX_SUMMARY_WORDS) {
    throw new ApiError(
      400,
      `Your summary (the text before the first “Heading 1”) is too long (${wordCount(summary)} words). Keep it to ${MAX_SUMMARY_WORDS} words or fewer — or remove it and we’ll draft one for you.`,
    );
  }

  return NextResponse.json({ title, summary, chapters });
});
