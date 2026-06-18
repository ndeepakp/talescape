"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CHAPTER_PAGE_WORDS,
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
import { RichTextEditor } from "@/components/RichTextEditor";
import { ChapterQuestionsEditor } from "@/components/ChapterQuestionsEditor";
import { BookCover } from "@/components/BookCover";
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

  const titleWords = wordCount(title);

  // --- Unsaved-changes guard --------------------------------------------------
  // Snapshot the form's starting state once; anything different means "dirty".
  const [initialSnapshot] = useState(() =>
    JSON.stringify({
      title: story?.title ?? "",
      summary: story?.summary ?? "",
      chapters: (Array.isArray(story?.chapters) ? story.chapters : []).map((c) => ({
        title: c.title ?? "",
        body: c.body,
        prices: c.prices ?? {},
        questions: c.questions ?? [],
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
    })),
    selected,
    chaptersPublic,
    offeredDurations,
    wholePrices: offerWhole ? wholePrices : {},
  });
  const dirty = currentSnapshot !== initialSnapshot;

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
  function addChapter() {
    setChapters((prev) => [
      ...prev,
      { id: newId(), title: "", body: "", prices: {}, questions: [] },
    ]);
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
    const res = await fetch(isEdit ? `/api/stories/${story!.id}` : "/api/stories", {
      method: isEdit ? "PUT" : "POST",
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
    leavingRef.current = true;
    // Drafts go back to where the author can find them again (their profile);
    // published stories go to the story (edit) or the feed (new).
    if (draft) {
      router.push(isEdit ? `/stories/${story!.id}/edit` : `/stories/${data.id}/edit`);
    } else {
      router.push(isEdit ? `/stories/${story!.id}` : "/feed");
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
              Chapters{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </span>

            {/* Who can read the chapters. */}
            <fieldset className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Who can read the chapters?
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
                        Set per-chapter prices on each chapter below.
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
                  the chapters straight away.
                </span>
              </label>
            </fieldset>

            {chapters.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No chapters yet. Add one when you&apos;re ready — you can publish
                with just a summary and add chapters later.
              </p>
            )}

            {chapters.map((chapter, i) => (
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
                    const numPages = Math.max(
                      1,
                      Math.ceil(words / CHAPTER_PAGE_WORDS),
                    );
                    return (
                      <p className="mt-1.5 text-xs text-zinc-500">
                        {words.toLocaleString()} word{words === 1 ? "" : "s"}
                        {words > CHAPTER_PAGE_WORDS && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {" "}
                            · Long chapter — readers will turn through ~
                            {numPages} pages (pagination starts over{" "}
                            {CHAPTER_PAGE_WORDS.toLocaleString()} words).
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
              </div>
            ))}

            <button
              type="button"
              onClick={addChapter}
              className="self-start rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
            >
              + Add chapter
            </button>
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

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={!!loading}
              className="h-12 flex-1 rounded-full btn-primary font-medium transition-colors disabled:opacity-50"
            >
              {loading === "publish"
                ? "Checking…"
                : isEdit && story?.status === "published"
                  ? "Save changes"
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
