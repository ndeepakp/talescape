"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MAX_CHAPTER_WORDS,
  MAX_SHORT_STORY_WORDS,
  MAX_SUMMARY_WORDS,
  MAX_TITLE_WORDS,
  htmlToText,
  validateStory,
  wordCount,
  type Chapter,
  type Question,
} from "@/lib/story-validation";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencySymbol,
  TIERS,
  TIER_LABELS,
  type Tier,
} from "@/lib/pricing";
import { RichTextEditor } from "@/components/write/RichTextEditor";
import { ChapterQuestionsEditor } from "@/components/write/ChapterQuestionsEditor";
import { ChapterPromptsEditor } from "@/components/write/ChapterPromptsEditor";
import { BookCover } from "@/components/story/BookCover";
import { COVER_PALETTES, type CoverStyle } from "@/lib/cover-style";

type Genre = { id: number; name: string };
type Match = { id: string; title: string; author: string | null; similarity: number };

type PriceMap = Partial<Record<Tier, number>>;

type EditStory = {
  id: string;
  title: string;
  summary: string;
  chapters: Chapter[];
  genreIds: number[];
  status: "draft" | "published";
  chaptersPublic: boolean;
  offeredDurations: Tier[];
  wholePrices: PriceMap;
  currency: string;
  coverUrl: string | null;
  coverStyle: CoverStyle | null;
  // The live published story this edit publishes back to. Set both when editing
  // a published story directly and when editing its working-copy draft.
  originId?: string | null;
};

// Local chapter shape: a stable id (so reordering keeps each editor's content
// attached to the right chapter), an optional title, the HTML body, and the
// per-duration prices for buying this chapter on its own.
type DraftChapter = {
  id: string;
  title: string;
  body: string;
  prices: PriceMap;
  questions: Question[];
  prompts: string[];
};

const ORIGINALITY_NOTE =
  "I take full responsibility for the originality of this content, and I confirm this story is not available outside TALEROOMS to avoid plagiarism. If it appears anywhere else, it was made available by me.";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function toDrafts(chapters: Chapter[]): DraftChapter[] {
  // Note: no default chapter — an author may publish with none and add later.
  return chapters.map((c) => ({
    id: newId(),
    title: c.title ?? "",
    body: c.body,
    prices: { ...(c.prices ?? {}) },
    questions: c.questions ?? [],
    prompts: c.prompts ?? [],
  }));
}

// Parse a price input ("" → 0); never negative, integers only.
function parsePrice(v: string): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function StoryForm({
  genres,
  story,
}: {
  genres: Genre[];
  story?: EditStory;
}) {
  const router = useRouter();
  const isEdit = !!story;
  const [title, setTitle] = useState(story?.title ?? "");
  const [summary, setSummary] = useState(story?.summary ?? "");
  const [chapters, setChapters] = useState<DraftChapter[]>(
    toDrafts(Array.isArray(story?.chapters) ? story.chapters : []),
  );
  // "single" = a short story (one continuous body, no chapter divisions);
  // "chapters" = a serialized story. A short story is stored as a single,
  // untitled chapter, so we infer the mode from an existing story's shape.
  const initialChapters = Array.isArray(story?.chapters) ? story.chapters : [];
  const [format, setFormat] = useState<"single" | "chapters">(
    initialChapters.length === 1 && !initialChapters[0]?.title ? "single" : "chapters",
  );
  const [selected, setSelected] = useState<number[]>(story?.genreIds ?? []);
  const [chaptersPublic, setChaptersPublic] = useState(story?.chaptersPublic ?? false);
  const [offeredDurations, setOfferedDurations] = useState<Tier[]>(
    story?.offeredDurations ?? [],
  );
  const [offerWhole, setOfferWhole] = useState(
    Object.keys(story?.wholePrices ?? {}).length > 0,
  );
  const [wholePrices, setWholePrices] = useState<PriceMap>(story?.wholePrices ?? {});
  const [currency, setCurrency] = useState<string>(story?.currency ?? DEFAULT_CURRENCY);
  const [coverUrl, setCoverUrl] = useState<string | null>(story?.coverUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  // Import failures are shown in a modal the writer must acknowledge.
  const [importError, setImportError] = useState<string | null>(null);
  // New stories default to a generated cover (covers boost reach); editing keeps
  // whatever was saved. An uploaded image takes precedence over this.
  const [coverStyle, setCoverStyle] = useState<CoverStyle | null>(
    story ? (story.coverStyle ?? null) : { palette: 0 },
  );

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setError(null);
    setCoverUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads/cover", { method: "POST", body: fd });
    setCoverUploading(false);
    if (res.ok) {
      const data = await res.json();
      setCoverUrl(data.url as string);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not upload the cover image.");
    }
  }
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "draft" | "publish">(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savingRef = useRef(false);

  // --- Save targets ----------------------------------------------------------
  // Editing a published story (directly or via its working-copy draft) keeps the
  // live story on the shelf: draft saves go to a separate working copy, and only
  // "publish" writes the live story.
  const originId = story?.originId ?? null;
  const publishedEdit = !!originId;
  // Where "publish / save changes" writes (the live story for published edits;
  // the row itself for a plain draft; a new row for a new story).
  const publishId = publishedEdit ? originId : isEdit ? story!.id : null;
  // Where draft saves write. A published story with no working copy yet starts
  // null — one is created lazily on the first save.
  const [draftId, setDraftId] = useState<string | null>(
    publishedEdit
      ? story!.status === "draft"
        ? story!.id // already editing the working copy
        : null // live story, no copy yet
      : isEdit
        ? story!.id // plain draft edits in place
        : null, // new story
  );

  const titleWords = wordCount(title);

  // --- Unsaved-changes guard --------------------------------------------------
  // Snapshot the form's starting state once; anything different means "dirty".
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      title: story?.title ?? "",
      summary: story?.summary ?? "",
      chapters: (Array.isArray(story?.chapters) ? story.chapters : []).map((c) => ({
        title: c.title ?? "",
        body: c.body,
        prices: c.prices ?? {},
        questions: c.questions ?? [],
        prompts: c.prompts ?? [],
      })),
      selected: story?.genreIds ?? [],
      chaptersPublic: story?.chaptersPublic ?? false,
      offeredDurations: story?.offeredDurations ?? [],
      wholePrices: story?.wholePrices ?? {},
    }),
  );
  // Set once we've navigated away on purpose (save/publish), so we don't prompt.
  const leavingRef = useRef(false);

  const currentSnapshot = JSON.stringify({
    title,
    summary,
    chapters: chapters.map((c) => ({
      title: c.title,
      body: c.body,
      prices: c.prices,
      questions: c.questions,
      prompts: c.prompts,
    })),
    selected,
    chaptersPublic,
    offeredDurations,
    wholePrices: offerWhole ? wholePrices : {},
  });
  const dirty = currentSnapshot !== savedSnapshot;

  // Warn on reload / tab close / leaving the site with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty || leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // In-app navigation (e.g. clicking "Feed") — confirm before leaving.
  function leave(href: string) {
    if (dirty && !window.confirm("You have unsaved changes. Leave this page and lose them?")) {
      return;
    }
    leavingRef.current = true;
    router.push(href);
  }
  // ---------------------------------------------------------------------------

  // --- Auto-save --------------------------------------------------------------
  // A short moment after typing stops, persist the work-in-progress as a draft.
  // The first save creates the draft (remembering its id); later saves update it
  // so we never leave duplicates. Published stories are excluded.
  async function saveDraftSilently(snapshot: string) {
    if (savingRef.current || loading || matches) return;
    if (!title.trim()) return;
    savingRef.current = true;
    setAutoStatus("saving");
    const offered = chaptersPublic ? [] : offeredDurations;
    const payloadChapters = chapters.map((c) => ({
      title: c.title.trim() ? c.title.trim() : null,
      body: c.body,
      prices: chaptersPublic ? {} : c.prices,
      questions: c.questions,
      prompts: c.prompts,
    }));
    const targetId = draftId;
    try {
      const res = await fetch(targetId ? `/api/stories/${targetId}` : "/api/stories", {
        method: targetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          chapters: payloadChapters,
          genreIds: selected,
          accepted,
          chaptersPublic,
          offeredDurations: offered,
          wholePrices: chaptersPublic || !offerWhole ? {} : wholePrices,
          currency,
          coverUrl,
          coverStyle: coverUrl ? null : coverStyle,
          status: "draft",
          // Creating the working copy of a published story.
          ...(!targetId && publishedEdit ? { draftOf: publishId } : {}),
        }),
      });
      if (!res.ok) {
        setAutoStatus("error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.id && !draftId) setDraftId(data.id as string);
      setSavedSnapshot(snapshot);
      setAutoStatus("saved");
    } catch {
      setAutoStatus("error");
    } finally {
      savingRef.current = false;
    }
  }

  // Latest-saver ref so the debounce effect doesn't re-subscribe each keystroke.
  const saveRef = useRef(saveDraftSilently);
  useEffect(() => {
    saveRef.current = saveDraftSilently;
  });

  useEffect(() => {
    if (!dirty || !title.trim()) return;
    const snap = currentSnapshot;
    const t = setTimeout(() => saveRef.current(snap), 1500);
    return () => clearTimeout(t);
  }, [currentSnapshot, dirty, title]);
  // ---------------------------------------------------------------------------

  function toggleGenre(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function updateChapter(id: string, patch: Partial<DraftChapter>) {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function setChapterPrice(id: string, tier: Tier, value: string) {
    setChapters((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, prices: { ...c.prices, [tier]: parsePrice(value) } } : c,
      ),
    );
  }
  // Copy the previous chapter's per-tier prices onto this chapter, so authors
  // don't have to retype the same prices for every chapter.
  function copyPricesFromPrev(index: number) {
    setChapters((prev) =>
      index <= 0
        ? prev
        : prev.map((c, i) =>
            i === index ? { ...c, prices: { ...prev[index - 1].prices } } : c,
          ),
    );
  }
  // Switch between short-story (single body) and chapters. Switching to "single"
  // merges any existing chapters into one untitled body so nothing is lost;
  // switching to "chapters" keeps the single body as chapter 1.
  function chooseFormat(next: "single" | "chapters") {
    if (next === format) return;
    if (next === "single") {
      setChapters((prev) => {
        if (prev.length === 0) {
          return [{ id: newId(), title: "", body: "", prices: {}, questions: [], prompts: [] }];
        }
        if (prev.length === 1) {
          return [{ ...prev[0], title: "" }];
        }
        return [
          {
            id: prev[0].id,
            title: "",
            body: prev.map((c) => c.body).filter(Boolean).join("\n"),
            prices: prev[0].prices,
            questions: prev.flatMap((c) => c.questions),
            prompts: prev.flatMap((c) => c.prompts),
          },
        ];
      });
    }
    setFormat(next);
  }

  function addChapter() {
    setChapters((prev) => [
      ...prev,
      { id: newId(), title: "", body: "", prices: {}, questions: [], prompts: [] },
    ]);
  }

  // Upload a .docx and turn it into chapters. "replace" seeds a brand-new story
  // (and its title); "append" adds the document's chapters to what's already
  // here. Pricing is left empty so the author decides it after reviewing.
  async function importDoc(file: File, mode: "replace" | "append") {
    setImportError(null);
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/docx", { method: "POST", body: fd });
    setImporting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setImportError(d.error ?? "Could not import that document.");
      return;
    }
    const data = await res.json();
    const imported: DraftChapter[] = (data.chapters ?? []).map(
      (c: {
        title: string | null;
        body: string;
        questions?: Question[];
        prompts?: string[];
      }) => ({
        id: newId(),
        title: c.title ?? "",
        body: c.body ?? "",
        prices: {},
        questions: Array.isArray(c.questions) ? c.questions : [],
        prompts: Array.isArray(c.prompts) ? c.prompts : [],
      }),
    );
    if (imported.length === 0) {
      setImportError("No readable content was found in that document.");
      return;
    }
    if (mode === "replace") {
      if (!title.trim() && typeof data.title === "string") setTitle(data.title);
      if (!summary.trim() && typeof data.summary === "string" && data.summary) {
        setSummary(data.summary);
      }
      setChapters(imported);
      // A heading-less document imports as one untitled chapter → a short story;
      // anything with headings is a multi-chapter story.
      setFormat(imported.length === 1 && !imported[0].title ? "single" : "chapters");
    } else {
      setChapters((prev) => [...prev, ...imported]);
      setFormat("chapters");
    }
  }

  function toggleTier(tier: Tier) {
    setOfferedDurations((prev) =>
      prev.includes(tier)
        ? prev.filter((t) => t !== tier)
        : TIERS.filter((t) => t === tier || prev.includes(t)),
    );
  }
  function removeChapter(id: string) {
    setChapters((prev) => prev.filter((c) => c.id !== id));
  }
  function moveChapter(index: number, dir: -1 | 1) {
    setChapters((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function publish(opts: {
    draft?: boolean;
    decision?: string;
    inspiredById?: string;
  }) {
    const draft = !!opts.draft;
    setError(null);
    // Pricing only applies to private stories; for public ones send none.
    const offered = chaptersPublic ? [] : offeredDurations;
    const payloadChapters = chapters.map((c) => ({
      title: c.title.trim() ? c.title.trim() : null,
      body: c.body,
      prices: chaptersPublic ? {} : c.prices,
      questions: c.questions,
      prompts: c.prompts,
    }));
    // Skip re-validating when resolving a similarity prompt — already validated.
    if (!opts.decision) {
      const invalid = validateStory(title, summary, payloadChapters, selected, accepted, {
        draft,
      });
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setLoading(draft ? "draft" : "publish");
    // Drafts write the working copy (created lazily); publishing writes the live
    // story (publishId) — which keeps a published story on the shelf.
    const targetId = draft ? draftId : (publishId ?? draftId);
    const res = await fetch(targetId ? `/api/stories/${targetId}` : "/api/stories", {
      method: targetId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        summary,
        chapters: payloadChapters,
        genreIds: selected,
        accepted,
        chaptersPublic,
        offeredDurations: offered,
        wholePrices: chaptersPublic || !offerWhole ? {} : wholePrices,
        currency,
        coverUrl,
        coverStyle: coverUrl ? null : coverStyle,
        status: draft ? "draft" : "published",
        decision: opts.decision,
        inspiredById: opts.inspiredById,
        ...(draft && !targetId && publishedEdit ? { draftOf: publishId } : {}),
      }),
    });
    setLoading(null);

    if (res.status === 409) {
      const data = await res.json();
      setMatches(data.matches as Match[]);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your story.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const finalId = (data.id as string | undefined) ?? targetId ?? null;
    leavingRef.current = true;
    if (draft) {
      if (finalId && !draftId) setDraftId(finalId);
      // Stay editing the (working-copy) draft; the live story keeps its place.
      router.push(`/stories/${finalId}/edit`);
    } else {
      // Published a live story's edit — discard its working copy if any.
      if (publishedEdit && draftId && draftId !== finalId) {
        await fetch(`/api/stories/${draftId}`, { method: "DELETE" }).catch(() => {});
      }
      router.push(
        publishedEdit
          ? `/stories/${publishId}`
          : isEdit
            ? `/stories/${story!.id}`
            : "/feed",
      );
    }
    router.refresh();
  }

  if (matches) {
    return (
      <div className="min-h-screen bg-[var(--page)] px-6 py-12">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            This looks similar to existing stories
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Before publishing, you can credit one of these as inspiration — or
            publish anyway, and we&apos;ll show readers the similar stories.
          </p>

          <ul className="mt-6 flex flex-col gap-4">
            {matches.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Link
                      href={`/stories/${m.id}`}
                      target="_blank"
                      className="font-semibold text-zinc-900 underline dark:text-zinc-50"
                    >
                      {m.title}
                    </Link>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      by {m.author ?? "Unknown"} · {Math.round(m.similarity * 100)}% similar
                    </p>
                  </div>
                  <button
                    onClick={() => publish({ decision: "inspired", inspiredById: m.id })}
                    disabled={!!loading}
                    className="shrink-0 h-10 rounded-full btn-primary px-4 text-sm font-medium disabled:opacity-50"
                  >
                    Inspired by this
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => publish({ decision: "discard" })}
              disabled={!!loading}
              className="h-11 rounded-full border border-zinc-300 px-5 font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Publish anyway
            </button>
            <button
              onClick={() => setMatches(null)}
              disabled={!!loading}
              className="h-11 rounded-full px-5 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Keep editing
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summaryOver = wordCount(summary) > MAX_SUMMARY_WORDS;

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      {/* Import-error popup — blocks until the writer acknowledges it. */}
      {importError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setImportError(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                ⚠️
              </span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Couldn’t import the document
              </h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{importError}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="rounded-full btn-primary px-5 py-2 text-sm font-medium"
                autoFocus
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {isEdit ? "Edit story" : "Write a story"}
          </h1>
          <button
            type="button"
            onClick={() => leave("/feed")}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Feed
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            publish({});
          }}
          className="mt-8 flex flex-col gap-6"
        >
          {/* 0. Import from a Word document — always available */}
          <div className="rounded-2xl border border-dashed border-accent/60 bg-accent/5 p-4">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                📄 Already wrote it in Word?
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Upload a <strong>.docx</strong> and we’ll turn it into a story
                automatically — split into chapters if you use Heading&nbsp;1s, or
                kept as a single short story if you don’t.{" "}
                {chapters.length === 0
                  ? "You review everything and set pricing before publishing."
                  : "Its chapters get added to what you already have."}
              </p>
              <details className="group mt-2">
                <summary className="cursor-pointer select-none text-xs font-semibold text-accent hover:underline">
                  How to format your document
                </summary>
                <ul className="mt-2 ml-4 list-disc space-y-0.5 text-xs text-zinc-500">
                  <li>
                    The <strong>file’s name</strong> becomes your story’s title
                    (max {MAX_TITLE_WORDS} words).
                  </li>
                  <li>
                    Any text <strong>before your first Heading&nbsp;1</strong>{" "}
                    becomes the story summary (max {MAX_SUMMARY_WORDS} words;
                    otherwise we draft one from your opening lines).
                  </li>
                  <li>
                    Start each chapter with a <strong>Heading&nbsp;1</strong> — its
                    text becomes the chapter title.
                  </li>
                  <li>
                    Everything under a heading (paragraphs, <strong>bold</strong>,{" "}
                    <em>italics</em>, lists) becomes that chapter’s body.
                  </li>
                  <li>
                    Want a <strong>chapter quiz</strong>? End a chapter with a{" "}
                    <strong>Heading 2</strong> called “Quiz”, then each question on
                    its own line followed by a bulleted list of options —{" "}
                    <strong>bold the correct option</strong>.
                  </li>
                  <li>
                    Want <strong>discussion prompts</strong>? Add a{" "}
                    <strong>Heading 2</strong> called “Discuss”, then one open
                    question per line — a reader’s answer becomes a public post.
                  </li>
                  <li>
                    No headings? It comes in as a <strong>short story</strong> —
                    one continuous piece, no chapters.
                  </li>
                </ul>
              </details>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full btn-primary px-4 py-2 text-sm font-medium">
                  {importing
                    ? "Importing…"
                    : chapters.length === 0
                      ? "Import from document"
                      : "Add chapters from document"}
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) importDoc(f, chapters.length === 0 ? "replace" : "append");
                    }}
                  />
                </label>
                <a
                  href="/talerooms-example-story.docx"
                  download
                  className="text-sm font-medium text-accent hover:underline"
                >
                  ⬇ Download an example
                </a>
              </div>
          </div>

          {/* 1. Title */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span>Title</span>
              <span
                className={
                  "font-normal " +
                  (titleWords > MAX_TITLE_WORDS ? "text-red-600" : "text-zinc-500")
                }
              >
                {titleWords}/{MAX_TITLE_WORDS} words
              </span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The title of your story"
              required
              className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {/* Optional cover image */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cover image <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <p className="text-xs text-zinc-500">
              A cover is the first thing readers see — stories with one get noticed
              and read more. Upload your own, pick a generated style, or skip it.
            </p>
            <div className="flex items-start gap-4">
              <BookCover
                title={title || "Your title"}
                coverUrl={coverUrl}
                coverStyle={coverStyle}
                className="h-40 w-28 shrink-0 rounded-md"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                    {coverUploading
                      ? "Uploading…"
                      : coverUrl
                        ? "Replace image"
                        : "Upload your own"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onCoverChange}
                      disabled={coverUploading}
                      className="hidden"
                    />
                  </label>
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverUrl(null)}
                      className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {!coverUrl && (
                  <div>
                    <p className="text-xs text-zinc-500">Or pick a generated cover:</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {COVER_PALETTES.map((p, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setCoverStyle({ palette: i })}
                          aria-label={`Cover style ${i + 1}`}
                          className={
                            "h-7 w-7 rounded-md border-2 transition " +
                            (coverStyle?.palette === i
                              ? "border-zinc-900 dark:border-zinc-100"
                              : "border-transparent")
                          }
                          style={{ background: p.bg }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setCoverStyle(null)}
                        className={
                          "flex h-7 items-center rounded-md border px-2 text-xs font-medium transition " +
                          (coverStyle === null
                            ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                            : "border-zinc-300 text-zinc-500 dark:border-zinc-700")
                        }
                      >
                        No cover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Summary (public tagline) */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span>Summary</span>
              <span
                className={"font-normal " + (summaryOver ? "text-red-600" : "text-zinc-500")}
              >
                {wordCount(summary)}/{MAX_SUMMARY_WORDS} words
              </span>
            </span>
            <span className="text-xs text-zinc-500">
              A short tagline — the only part readers see before they buy access.
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two lines that hook the reader…"
              rows={3}
              className="rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {/* 3. Chapters (rich text). Visibility is the author's choice. */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {format === "single" ? "Story" : "Chapters"}{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </span>

            {/* Format: a single short story, or a story told in chapters. */}
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                How is this story structured?
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["single", "📖 Short story", "One continuous piece"],
                    ["chapters", "📚 Chapters", "Told in multiple parts"],
                  ] as const
                ).map(([value, label, hint]) => {
                  const on = format === value;
                  return (
                    <button
                      type="button"
                      key={value}
                      onClick={() => chooseFormat(value)}
                      className={
                        "flex flex-col items-start rounded-xl border px-4 py-2 text-left transition-colors " +
                        (on
                          ? "border-accent bg-accent/10"
                          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900")
                      }
                    >
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {label}
                      </span>
                      <span className="text-xs text-zinc-500">{hint}</span>
                    </button>
                  );
                })}
              </div>
              {format === "single" && (
                <p className="text-xs text-zinc-500">
                  Just write your story below — no chapters. Great for short
                  stories and one-shots.
                </p>
              )}
            </div>

            {/* Who can read the chapters. */}
            <fieldset className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {format === "single" ? "Who can read this story?" : "Who can read the chapters?"}
              </legend>
              <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="chaptersVisibility"
                  checked={!chaptersPublic}
                  onChange={() => setChaptersPublic(false)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-medium">Private</span> — readers buy
                  access for the duration and price you set below.
                </span>
              </label>

              {!chaptersPublic && (
                <div className="ml-7 flex flex-col gap-3">
                  <div>
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="mt-1.5 block h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Access durations you offer
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {TIERS.map((t) => {
                        const on = offeredDurations.includes(t);
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => toggleTier(t)}
                            className={
                              "rounded-full border px-3 py-1 text-sm transition-colors " +
                              (on
                                ? "chip-active"
                                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
                            }
                          >
                            {TIER_LABELS[t]}
                          </button>
                        );
                      })}
                    </div>
                    <span className="mt-1 block text-xs text-zinc-500">
                      A reader picks one of these when buying. Access expires after
                      it (Always = never). Prices are in {currencySymbol(currency)}; 0 = free.
                    </span>
                  </div>

                  {offeredDurations.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={offerWhole}
                          onChange={(e) => setOfferWhole(e.target.checked)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className="font-medium">
                          Offer the whole story as a bundle
                        </span>
                      </label>
                      {offerWhole && (
                        <div className="flex flex-wrap gap-3">
                          {offeredDurations.map((t) => (
                            <label
                              key={t}
                              className="flex flex-col gap-1 text-xs text-zinc-500"
                            >
                              <span>{TIER_LABELS[t]}</span>
                              <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-2 dark:border-zinc-700 dark:bg-zinc-950">
                                <span className="text-zinc-500">{currencySymbol(currency)}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={wholePrices[t] ?? ""}
                                  onChange={(e) =>
                                    setWholePrices((p) => ({
                                      ...p,
                                      [t]: parsePrice(e.target.value),
                                    }))
                                  }
                                  className="h-8 w-20 bg-transparent px-1 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                                />
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-zinc-500">
                        {format === "single"
                          ? "This price covers the whole story."
                          : "Set per-chapter prices on each chapter below."}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="chaptersVisibility"
                  checked={chaptersPublic}
                  onChange={() => setChaptersPublic(true)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-medium">Public</span> — anyone can read
                  {format === "single" ? " it" : " the chapters"} straight away.
                </span>
              </label>
            </fieldset>

            {/* Short-story mode: one continuous body, no chapter chrome. */}
            {format === "single" && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <RichTextEditor
                  value={chapters[0]?.body ?? ""}
                  onChange={(html) => {
                    if (chapters[0]) updateChapter(chapters[0].id, { body: html });
                    else {
                      setChapters([
                        { id: newId(), title: "", body: html, prices: {}, questions: [], prompts: [] },
                      ]);
                    }
                  }}
                  placeholder="Write your story here…"
                />
                {(() => {
                  const words = wordCount(htmlToText(chapters[0]?.body ?? ""));
                  const over = words > MAX_SHORT_STORY_WORDS;
                  return (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      <span className={over ? "font-medium text-red-600 dark:text-red-400" : ""}>
                        {words.toLocaleString()}/{MAX_SHORT_STORY_WORDS.toLocaleString()} words
                      </span>
                      {over && (
                        <span className="text-red-600 dark:text-red-400">
                          {" "}— trim {(words - MAX_SHORT_STORY_WORDS).toLocaleString()} to publish.
                        </span>
                      )}
                    </p>
                  );
                })()}
                {chapters[0] && (
                  <>
                    <ChapterQuestionsEditor
                      questions={chapters[0].questions}
                      onChange={(q) => updateChapter(chapters[0].id, { questions: q })}
                    />
                    <ChapterPromptsEditor
                      prompts={chapters[0].prompts}
                      onChange={(p) => updateChapter(chapters[0].id, { prompts: p })}
                    />
                  </>
                )}
              </div>
            )}

            {format === "chapters" && chapters.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No chapters yet. Add one when you&apos;re ready — you can publish
                with just a summary and add chapters later.
              </p>
            )}

            {format === "chapters" && chapters.map((chapter, i) => (
              <div
                key={chapter.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Chapter {i + 1}
                  </span>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <button
                      type="button"
                      onClick={() => moveChapter(i, -1)}
                      disabled={i === 0}
                      aria-label="Move chapter up"
                      className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChapter(i, 1)}
                      disabled={i === chapters.length - 1}
                      aria-label="Move chapter down"
                      className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChapter(chapter.id)}
                      aria-label="Remove chapter"
                      className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  value={chapter.title}
                  onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                  placeholder="Chapter title (optional)"
                  className="mt-3 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <div className="mt-2">
                  <RichTextEditor
                    value={chapter.body}
                    onChange={(html) => updateChapter(chapter.id, { body: html })}
                    placeholder="Write this chapter, scene by scene…"
                  />
                  {(() => {
                    const words = wordCount(htmlToText(chapter.body));
                    const over = words > MAX_CHAPTER_WORDS;
                    return (
                      <p className="mt-1.5 text-xs text-zinc-500">
                        <span className={over ? "font-medium text-red-600 dark:text-red-400" : ""}>
                          {words.toLocaleString()}/{MAX_CHAPTER_WORDS.toLocaleString()} words
                        </span>
                        {over && (
                          <span className="text-red-600 dark:text-red-400">
                            {" "}— trim {(words - MAX_CHAPTER_WORDS).toLocaleString()} to publish.
                          </span>
                        )}
                      </p>
                    );
                  })()}
                </div>

                {!chaptersPublic && offeredDurations.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Price to buy just this chapter
                      </span>
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => copyPricesFromPrev(i)}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          Copy from previous chapter
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      {offeredDurations.map((t) => (
                        <label
                          key={t}
                          className="flex flex-col gap-1 text-xs text-zinc-500"
                        >
                          <span>{TIER_LABELS[t]}</span>
                          <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-2 dark:border-zinc-700 dark:bg-zinc-950">
                            <span className="text-zinc-500">{currencySymbol(currency)}</span>
                            <input
                              type="number"
                              min={0}
                              value={chapter.prices[t] ?? ""}
                              onChange={(e) =>
                                setChapterPrice(chapter.id, t, e.target.value)
                              }
                              className="h-8 w-20 bg-transparent px-1 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <ChapterQuestionsEditor
                  questions={chapter.questions}
                  onChange={(q) => updateChapter(chapter.id, { questions: q })}
                />
                <ChapterPromptsEditor
                  prompts={chapter.prompts}
                  onChange={(p) => updateChapter(chapter.id, { prompts: p })}
                />
              </div>
            ))}

            {format === "chapters" && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addChapter}
                className="rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
              >
                + Add chapter
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10">
                {importing ? "Importing…" : "+ Add chapter from .docx"}
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) importDoc(f, "append");
                  }}
                />
              </label>
            </div>
            )}
          </div>

          {/* 4. Genres */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Genres <span className="font-normal text-zinc-500">(pick at least one)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => {
                const active = selected.includes(g.id);
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (active
                        ? "chip-active"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
                    }
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Originality note (required to publish) */}
          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>{ORIGINALITY_NOTE}</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {autoStatus !== "idle" && (
            <p className="text-right text-xs text-zinc-400">
              {autoStatus === "saving"
                ? "Saving…"
                : autoStatus === "saved"
                  ? publishedEdit
                    ? "Draft of your published story saved ✓"
                    : "Draft saved automatically ✓"
                  : "Couldn’t auto-save — use “Save as draft” to be safe."}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={!!loading}
              className="h-12 flex-1 rounded-full btn-primary font-medium transition-colors disabled:opacity-50"
            >
              {loading === "publish"
                ? "Checking…"
                : publishedEdit
                  ? "Publish changes"
                  : "Publish story"}
            </button>
            <button
              type="button"
              onClick={() => publish({ draft: true })}
              disabled={!!loading}
              className="h-12 flex-1 rounded-full btn-primary font-medium transition-colors disabled:opacity-50"
            >
              {loading === "draft" ? "Saving…" : "Save as draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
