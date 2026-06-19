// Helpers for turning an uploaded .docx into a story. Word "Heading 1" styles
// become chapter boundaries (heading text = chapter title; the content in
// between = that chapter's rich-text body). Any text *before* the first heading
// becomes the story summary.

export type ImportedChapter = { title: string | null; body: string };

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Decode the few HTML entities mammoth emits in text.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Trim plain text to at most `maxWords` words (adds an ellipsis if shortened).
function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

// Remove anything we don't want to store/render from author-uploaded HTML:
// scripts/styles, embedded images (docx images come through as huge base64),
// and inline event handlers.
export function sanitizeImportedHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*img[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
}

// Parse sanitized docx HTML into a story summary + chapters.
//   - Each top-level <h1> starts a new chapter (heading = title).
//   - Text before the first heading becomes the summary, returned verbatim so
//     the caller can enforce the word limit (and fail the import if exceeded).
//   - If there's no such preamble, a short blurb is derived from the opening of
//     the first chapter so the summary is never empty (this one is pre-trimmed).
//   - With no headings at all, the whole document is a single chapter.
export function parseDocx(html: string): {
  summary: string | null;
  chapters: ImportedChapter[];
} {
  const segments = html
    .split(/(?=<h1[\s>])/i)
    .map((s) => s.trim())
    .filter(Boolean);

  let summary: string | null = null;
  const chapters: ImportedChapter[] = [];

  for (const seg of segments) {
    const m = seg.match(/^<h1[^>]*>([\s\S]*?)<\/h1>([\s\S]*)$/i);
    if (m) {
      const title = decodeEntities(stripTags(m[1])).slice(0, 200) || null;
      const body = m[2].trim();
      chapters.push({ title, body: body || "<p></p>" });
    } else {
      // Preamble before the first heading → the story summary. Returned as-is
      // (no truncation) so the caller can validate it against the word limit.
      const text = decodeEntities(stripTags(seg));
      if (text) summary = text;
    }
  }

  if (chapters.length === 0 && stripTags(html)) {
    chapters.push({ title: null, body: html });
  }

  // No explicit summary → derive a short one from the first chapter's opening.
  if (!summary && chapters.length > 0) {
    const firstText = decodeEntities(stripTags(chapters[0].body));
    if (firstText) summary = clampWords(firstText, 40);
  }

  return { summary, chapters };
}
