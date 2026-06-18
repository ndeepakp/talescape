"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAPTER_PAGE_WORDS, wordCount } from "@/lib/story-validation";
import { ChapterQuestions } from "@/components/ChapterQuestions";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

// Lowercase + collapse whitespace, so occurrence counting is stable across the
// HTML and the selection's plain text.
function norm(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase();
}

// Count non-overlapping occurrences of `needle` in `hay` (both pre-normalised).
function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

// Chapter bodies arrive base64-encoded so the plain text never appears in the
// page source. Decoded client-side after mount (UTF-8 safe). Falls back to the
// input if it isn't valid base64 (e.g. already-plain content).
function decodeBody(b64: string): string {
  if (!b64) return "";
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return b64;
  }
}

// Splits a chapter's HTML into "pages" of roughly `budget` words, breaking
// only between top-level blocks so markup is never cut mid-element. Used to
// paginate very long chapters.
function paginateHtml(html: string, budget = CHAPTER_PAGE_WORDS): string[] {
  if (!html || typeof window === "undefined") return [html];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const pages: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const node of Array.from(doc.body.childNodes)) {
    const piece =
      node.nodeType === 1 ? (node as Element).outerHTML : (node.textContent ?? "");
    const len = wordCount(node.textContent ?? "");
    if (curLen > 0 && curLen + len > budget) {
      pages.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += piece;
    curLen += len;
  }
  if (cur.trim()) pages.push(cur);
  return pages.length ? pages : [html];
}

export type ReaderChapter = {
  index: number;
  title: string | null;
  body: string | null; // null when locked
  locked: boolean;
};
export type Bookmark = {
  id: string;
  chapter_index: number;
  quote: string;
  occurrence: number;
};

export function ChapterReader({
  storyId,
  chapters,
  initialChapter,
  initialPage,
  initialBookmarks,
  autoResume,
}: {
  storyId: string;
  chapters: ReaderChapter[];
  initialChapter: number;
  initialPage: number;
  initialBookmarks: Bookmark[];
  autoResume: boolean;
}) {
  const clampedInitial = Math.min(
    Math.max(initialChapter, 0),
    Math.max(chapters.length - 1, 0),
  );
  const [current, setCurrent] = useState(clampedInitial);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [sel, setSel] = useState<{
    top: number;
    left: number;
    text: string;
    occurrence: number;
  } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const chapter = chapters[current];
  const chapterBookmarks = bookmarks.filter((b) => b.chapter_index === current);

  // Paginate long chapters. We only paginate after mount (DOMParser is
  // client-only); the first paint matches the server (one page) to avoid a
  // hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  // Only decode (and render) the body client-side after mount, so the chapter
  // text is never part of the server-rendered HTML.
  const body = useMemo(
    () => (mounted ? decodeBody(chapter?.body ?? "") : ""),
    [mounted, chapter?.body],
  );
  const pages = useMemo(() => (mounted ? paginateHtml(body) : [""]), [mounted, body]);
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(pages.length - 1, 0));
  // Direction of the last page turn, so the new page animates like a book flip.
  const [flipDir, setFlipDir] = useState<"next" | "prev" | null>(null);

  // Restore the reader to their last page in the starting chapter, once the
  // chapter has been paginated. Runs once; for other chapters we start at page 0.
  const restoredPageRef = useRef(false);
  useEffect(() => {
    if (restoredPageRef.current || !mounted) return;
    restoredPageRef.current = true;
    if (current === clampedInitial && initialPage > 0) {
      const target = Math.min(initialPage, pages.length - 1);
      const raf = requestAnimationFrame(() => setPage(target));
      return () => cancelAnimationFrame(raf);
    }
  }, [mounted, pages.length, current, clampedInitial, initialPage]);

  // Auto-save reading progress (chapter + page) — this is the automatic page
  // bookmark. Debounced, and held until the saved page has been restored so we
  // don't overwrite it with page 0 on arrival.
  useEffect(() => {
    if (!mounted || !restoredPageRef.current) return;
    if (!chapter || chapter.locked) return;
    const t = setTimeout(() => {
      fetch(`/api/stories/${storyId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIndex: current, pageIndex: safePage }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [mounted, storyId, current, safePage, chapter]);

  // Unwrap any existing highlight, then highlight + scroll to the `occ`-th (0-based)
  // match of `quote` within the currently-rendered page.
  const highlightDom = useCallback((quote: string, occ = 0) => {
    const el = bodyRef.current;
    if (!el) return;
    el.querySelectorAll("mark.bm").forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent?.insertBefore(m.firstChild, m);
      parent?.removeChild(m);
      parent?.normalize();
    });
    const needle = quote.toLowerCase();
    let remaining = occ;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const lower = (node.nodeValue ?? "").toLowerCase();
      let from = 0;
      while (true) {
        const idx = lower.indexOf(needle, from);
        if (idx < 0) break;
        if (remaining === 0) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + quote.length);
          const mark = document.createElement("mark");
          mark.className = "bm";
          try {
            range.surroundContents(mark);
            mark.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            (node.parentElement ?? el).scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
        remaining--;
        from = idx + needle.length;
      }
    }
  }, []);

  // Jump to a bookmark — the `occ`-th occurrence of `quote` in the chapter.
  // Finds the page holding that occurrence and its index within that page, then
  // switches pages (if needed) and highlights it.
  const jumpTo = useCallback(
    (quote: string, occ = 0) => {
      const needle = norm(quote);
      let remaining = occ;
      let target = -1;
      let local = 0;
      for (let i = 0; i < pages.length; i++) {
        const count = countOccurrences(norm(stripTags(pages[i])), needle);
        if (remaining < count) {
          target = i;
          local = remaining;
          break;
        }
        remaining -= count;
      }
      if (target < 0) {
        // Not found at that occurrence (e.g. content changed) — fall back to the
        // first match anywhere.
        target = pages.findIndex((p) => norm(stripTags(p)).includes(needle));
        local = 0;
      }
      if (target < 0) return;
      if (target !== safePage) {
        setFlipDir(null);
        setPage(target);
        setTimeout(() => highlightDom(quote, local), 80);
      } else {
        highlightDom(quote, local);
      }
    },
    [pages, safePage, highlightDom],
  );

  // On arrival via a "continue" link, jump to the newest bookmark in the chapter.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !autoResume) return;
    resumedRef.current = true;
    const latest = bookmarks.filter((b) => b.chapter_index === clampedInitial).at(-1);
    if (latest) setTimeout(() => jumpTo(latest.quote, latest.occurrence), 150);
  }, [autoResume, bookmarks, clampedInitial, jumpTo]);

  function onMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString().trim().replace(/\s+/g, " ") ?? "";
    if (!text || !selection || selection.isCollapsed || !bodyRef.current) {
      return;
    }
    if (!bodyRef.current.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);
    const quote = text.slice(0, 300);
    const needle = norm(quote);
    // Which occurrence of this text within the chapter the selection is: count
    // the matches on earlier pages, plus the matches before it on this page.
    const pre = document.createRange();
    pre.selectNodeContents(bodyRef.current);
    pre.setEnd(range.startContainer, range.startOffset);
    let occurrence = countOccurrences(norm(pre.toString()), needle);
    for (let i = 0; i < safePage; i++) {
      occurrence += countOccurrences(norm(stripTags(pages[i])), needle);
    }
    const rect = range.getBoundingClientRect();
    setSel({ top: rect.top - 44, left: rect.left, text: quote, occurrence });
  }

  async function addBookmark() {
    if (!sel) return;
    const quote = sel.text;
    const occurrence = sel.occurrence;
    setSel(null);
    // Don't add a duplicate — same text AND same occurrence in this chapter.
    const dupe = bookmarks.find(
      (b) =>
        b.chapter_index === current &&
        b.occurrence === occurrence &&
        b.quote.trim().toLowerCase() === quote.trim().toLowerCase(),
    );
    if (dupe) {
      window.getSelection()?.removeAllRanges();
      jumpTo(dupe.quote, dupe.occurrence);
      return;
    }
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, chapterIndex: current, quote, occurrence }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookmarks((prev) => [
        ...prev,
        {
          id: data.id,
          chapter_index: current,
          quote: data.quote,
          occurrence: data.occurrence ?? occurrence,
        },
      ]);
      window.getSelection()?.removeAllRanges();
      jumpTo(quote, occurrence);
    }
  }

  async function removeBookmark(id: string) {
    const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
    if (res.ok) setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }

  function selectChapter(i: number) {
    setSel(null);
    setFlipDir(null); // changing chapters shouldn't animate like a page flip
    setCurrent(i);
    setPage(0);
  }

  function goPage(p: number) {
    setSel(null);
    setFlipDir(p > safePage ? "next" : "prev");
    setPage(p);
    bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (chapters.length === 0) return null;

  return (
    <div className="mt-6" onMouseDown={() => setSel(null)}>
      {/* Chapter pagination buttons */}
      <div className="flex flex-wrap gap-2">
        {chapters.map((ch) => {
          const active = ch.index === current;
          return (
            <button
              key={ch.index}
              type="button"
              onClick={() => selectChapter(ch.index)}
              className={
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                (active
                  ? "chip-active"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
              title={ch.title ?? `Chapter ${ch.index + 1}`}
            >
              {ch.locked && <span aria-hidden="true">🔒</span>}
              <span className="max-w-[12rem] truncate">
                {ch.title ? ch.title : `Chapter ${ch.index + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current chapter */}
      <div className="mt-6">
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {chapter.title ? chapter.title : `Chapter ${current + 1}`}
        </h3>

        {chapter.locked ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            <span aria-hidden="true">🔒</span> This chapter is locked — buy access
            below to read it.
          </div>
        ) : (
          <>
            {chapterBookmarks.length > 0 && (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Your bookmarks in this chapter
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {chapterBookmarks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => jumpTo(b.quote, b.occurrence)}
                        className="min-w-0 flex-1 truncate text-left text-zinc-700 hover:underline dark:text-zinc-300"
                        title="Jump to bookmark"
                      >
                        “{b.quote}”
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(b.id)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-xs text-zinc-400">
              Tip: select any word or line and click “Bookmark” to save your spot.
            </p>

            <div className="mt-3 flex items-center gap-2 sm:gap-4">
              {pages.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 0}
                  onClick={() => goPage(safePage - 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-2xl leading-none text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span aria-hidden="true">‹</span>
                </button>
              )}

              <div className="book-stage min-w-0 flex-1">
                <div
                  key={`${current}-${safePage}`}
                  className={
                    "book-page" +
                    (flipDir === "next"
                      ? " pageflip-next"
                      : flipDir === "prev"
                        ? " pageflip-prev"
                        : "")
                  }
                >
                  <div
                    ref={bodyRef}
                    onMouseUp={onMouseUp}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    className="richtext"
                    dangerouslySetInnerHTML={{ __html: pages[safePage] ?? "" }}
                  />
                </div>
              </div>

              {pages.length > 1 && (
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage === pages.length - 1}
                  onClick={() => goPage(safePage + 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-2xl leading-none text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span aria-hidden="true">›</span>
                </button>
              )}
            </div>

            {pages.length > 1 && (
              <p className="mt-3 text-center text-xs text-zinc-400">
                Page {safePage + 1} / {pages.length}
              </p>
            )}

            <ChapterQuestions storyId={storyId} chapterIndex={current} />
          </>
        )}

        {/* Prev / next */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => selectChapter(current - 1)}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            ← Previous
          </button>
          <span className="text-xs text-zinc-400">
            {current + 1} / {chapters.length}
          </span>
          <button
            type="button"
            disabled={current === chapters.length - 1}
            onClick={() => selectChapter(current + 1)}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Floating "Bookmark" button shown over a text selection */}
      {sel && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={addBookmark}
          style={{ position: "fixed", top: sel.top, left: sel.left, zIndex: 60 }}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-lg"
        >
          ★ Bookmark
        </button>
      )}
    </div>
  );
}
