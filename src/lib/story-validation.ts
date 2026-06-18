import { type Tier, TIERS, normalizePrices } from "./pricing";

export const MAX_TITLE_WORDS = 20;
export const MAX_SUMMARY_WORDS = 150;
// Chapters longer than this (visible words) are split into pages for readers.
// Shared by the reader (ChapterReader) and the write form's hint.
export const CHAPTER_PAGE_WORDS = 750;

// An engagement question shown after a chapter. `mcq` carries 2+ options;
// `open` is free-text. `id` is stable (client-generated) so answers survive edits.
export type Question = {
  id: string;
  type: "mcq" | "open";
  prompt: string;
  options: string[]; // [] for open questions
};

// A single chapter the author writes. The title is optional; the body is rich
// HTML (produced by the TipTap editor). `prices` maps an offered duration tier
// to the price of buying just this chapter for that long (0 = free).
export type Chapter = {
  title: string | null;
  body: string;
  prices: Partial<Record<Tier, number>>;
  questions: Question[];
};

function newQuestionId(): string {
  return `q-${Math.random().toString(36).slice(2, 10)}`;
}

// Cleans an untrusted questions array: trims prompts (drops empty), keeps stable
// ids, and requires MCQs to have at least two non-empty options.
export function normalizeQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) return [];
  const out: Question[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as {
      id?: unknown;
      type?: unknown;
      prompt?: unknown;
      options?: unknown;
    };
    const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
    if (!prompt) continue;
    const type = r.type === "mcq" ? "mcq" : "open";
    const id = typeof r.id === "string" && r.id ? r.id : newQuestionId();
    let options: string[] = [];
    if (type === "mcq") {
      options = (Array.isArray(r.options) ? r.options : [])
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim())
        .filter(Boolean)
        .slice(0, 8);
      if (options.length < 2) continue; // an MCQ needs at least two options
    }
    out.push({ id, type, prompt: prompt.slice(0, 500), options });
  }
  return out;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Strips HTML to readable plain text. Used to tell whether a chapter actually
// has content, and (in the API) to build the plain-text used for the
// originality/embedding checks.
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// Normalises arbitrary JSON into a clean Chapter[]: trims titles (empty → null),
// keeps the HTML body, normalises per-chapter prices to the offered tiers, and
// drops any chapter whose visible text is blank.
export function normalizeChapters(
  input: unknown,
  offered: Tier[] = TIERS,
): Chapter[] {
  if (!Array.isArray(input)) return [];
  const out: Chapter[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as {
      title?: unknown;
      body?: unknown;
      prices?: unknown;
      questions?: unknown;
    };
    const bodyHtml = typeof r.body === "string" ? r.body : "";
    if (!htmlToText(bodyHtml)) continue; // skip empty chapters
    const titleStr = typeof r.title === "string" ? r.title.trim() : "";
    out.push({
      title: titleStr ? titleStr : null,
      body: bodyHtml.trim(),
      prices: normalizePrices(r.prices, offered),
      questions: normalizeQuestions(r.questions),
    });
  }
  return out;
}

// Returns a human-readable error if the story is invalid, or null if it passes.
// A draft only needs a valid title (so it can be found again later); a published
// story needs the full set. Chapters are optional in both cases — an author can
// publish the public summary and add chapters later.
export function validateStory(
  title: string,
  summary: string,
  chapters: unknown,
  genreIds: unknown,
  accepted: unknown,
  opts: { draft?: boolean } = {},
): string | null {
  if (!title.trim()) {
    return "A title is required.";
  }
  if (wordCount(title) > MAX_TITLE_WORDS) {
    return `Title must be ${MAX_TITLE_WORDS} words or fewer.`;
  }

  const summaryTrim = summary.trim();
  if (wordCount(summaryTrim) > MAX_SUMMARY_WORDS) {
    return `Summary must be ${MAX_SUMMARY_WORDS} words or fewer.`;
  }

  // Drafts stop here — everything below is only required to publish.
  if (opts.draft) {
    return null;
  }

  if (!summaryTrim) {
    return "A summary is required.";
  }

  // Chapters are optional, but any chapter the author did add must have content.
  // normalizeChapters already drops blank ones, so we just sanity-check shape.
  if (chapters !== undefined && !Array.isArray(chapters)) {
    return "Something looks off with your chapters.";
  }

  const validGenres = Array.isArray(genreIds)
    ? genreIds.filter((g) => Number.isInteger(g))
    : [];
  if (validGenres.length === 0) {
    return "Please pick at least one genre.";
  }

  if (accepted !== true) {
    return "Please confirm you take responsibility for the originality of your content.";
  }

  return null;
}
