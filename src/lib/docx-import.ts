// Helpers for turning an uploaded .docx into a story. Word "Heading 1" styles
// become chapter boundaries (heading text = chapter title; the content in
// between = that chapter's rich-text body). Any text *before* the first heading
// becomes the story summary.
import { type Question } from "@/lib/story-validation";

export type ImportedChapter = {
  title: string | null;
  body: string;
  questions: Question[];
  prompts: string[];
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function questionId(): string {
  return `q-${Math.random().toString(36).slice(2, 10)}`;
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

// True for a chapter's quiz heading text ("Quiz", "Q&A", "Questions", …).
function isQnaLabel(text: string): boolean {
  return /^(quiz|quizzes|q\s*&\s*a|q\s*and\s*a|questions?|reader\s*q\s*&\s*a)\s*:?$/i.test(
    text.trim(),
  );
}

// Parse the HTML after a chapter's "Quiz" heading into graded questions. Each
// <p> is a question prompt; the <ul>/<ol> right after it supplies the options,
// and whichever option is bold (<strong>/<b>) is the correct answer (defaults to
// the first if none is marked). Questions with fewer than two options are
// dropped — a quiz question must be answerable.
function parseQnaBlock(html: string): Question[] {
  const out: Question[] = [];
  let current: { prompt: string; options: string[]; answer: number } | null = null;
  const flush = () => {
    if (current && current.options.length >= 2) {
      out.push({
        id: questionId(),
        prompt: current.prompt.slice(0, 500),
        options: current.options,
        answer: Math.min(current.answer, current.options.length - 1),
      });
    }
    current = null;
  };

  const tokenRe = /<(p|ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === "p") {
      const prompt = decodeEntities(stripTags(m[2]));
      if (!prompt) continue;
      flush();
      current = { prompt, options: [], answer: 0 };
    } else if (current) {
      const opts: string[] = [];
      let answer = 0;
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      while ((li = liRe.exec(m[2])) !== null) {
        const o = decodeEntities(stripTags(li[1]));
        if (!o) continue;
        if (/<(strong|b)[\s>]/i.test(li[1])) answer = opts.length; // bold = correct
        opts.push(o);
      }
      current.options = opts.slice(0, 8);
      current.answer = answer;
    }
  }
  flush();
  return out.slice(0, 12);
}

// True for a chapter's discussion heading ("Discuss", "Discussion", "Prompts").
function isDiscussLabel(text: string): boolean {
  return /^(discuss|discussion|prompts?|talk\s*about\s*it|reflect)\s*:?$/i.test(
    text.trim(),
  );
}

// Each <p>/<li> after a "Discuss" heading is one open discussion prompt.
function parsePromptsBlock(html: string): string[] {
  const out: string[] = [];
  const re = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = decodeEntities(stripTags(m[2]));
    if (t) out.push(t.slice(0, 280));
  }
  return out.slice(0, 5);
}

// Split a chapter body at its optional "Quiz" and/or "Discuss" Heading 2 blocks,
// returning the readable body plus the parsed quiz questions and discussion
// prompts. The body is everything before the first such heading; each block runs
// to the next special heading (or the end).
function extractChapterExtras(body: string): {
  body: string;
  questions: Question[];
  prompts: string[];
} {
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const marks: { index: number; end: number; kind: "quiz" | "discuss" }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const label = decodeEntities(stripTags(m[1]));
    if (isQnaLabel(label)) marks.push({ index: m.index, end: re.lastIndex, kind: "quiz" });
    else if (isDiscussLabel(label)) {
      marks.push({ index: m.index, end: re.lastIndex, kind: "discuss" });
    }
  }
  if (marks.length === 0) return { body, questions: [], prompts: [] };

  const clean = body.slice(0, marks[0].index).trim() || "<p></p>";
  let questions: Question[] = [];
  let prompts: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const segment = body.slice(marks[i].end, marks[i + 1]?.index);
    if (marks[i].kind === "quiz") questions = parseQnaBlock(segment);
    else prompts = parsePromptsBlock(segment);
  }
  return { body: clean, questions, prompts };
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
      const { body, questions, prompts } = extractChapterExtras(m[2].trim());
      chapters.push({ title, body: body || "<p></p>", questions, prompts });
    } else {
      // Preamble before the first heading → the story summary. Returned as-is
      // (no truncation) so the caller can validate it against the word limit.
      const text = decodeEntities(stripTags(seg));
      if (text) summary = text;
    }
  }

  if (chapters.length === 0 && stripTags(html)) {
    const { body, questions, prompts } = extractChapterExtras(html);
    chapters.push({ title: null, body, questions, prompts });
  }

  // No explicit summary → derive a short one from the first chapter's opening.
  if (!summary && chapters.length > 0) {
    const firstText = decodeEntities(stripTags(chapters[0].body));
    if (firstText) summary = clampWords(firstText, 40);
  }

  return { summary, chapters };
}
