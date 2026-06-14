"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAPTER_PAGE_WORDS, wordCount } from "@/lib/story-validation";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
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
export type Bookmark = { id: string; chapter_index: number; quote: string };

export function ChapterReader({
  storyId,
  chapters,
  initialChapter,
  initialBookmarks,
  autoResume,
}: {
  storyId: string;
  chapters: ReaderChapter[];
  initialChapter: number;
  initialBookmarks: Bookmark[];
  autoResume: boolean;
}) {
  const clampedInitial = Math.min(
    Math.max(initialChapter, 0),
    Math.max(chapters.length - 1, 0),
  );
  const [current, setCurrent] = useState(clampedInitial);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [sel, setSel] = useState<{ top: number; left: number; text: string } | null>(null);
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
  const body = chapter?.body ?? "";
  const pages = useMemo(() => (mounted ? paginateHtml(body) : [body]), [mounted, body]);
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(pages.length - 1, 0));
  // Direction of the last page turn, so the new page animates like a book flip.
  const [flipDir, setFlipDir] = useState<"next" | "prev" | null>(null);

  // Record reading progress whenever an unlocked chapter is opened.
  useEffect(() => {
    if (!chapter || chapter.locked) return;
    fetch(`/api/stories/${storyId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIndex: current }),
    }).catch(() => {});
  }, [storyId, current, chapter]);

  // Unwrap any existing highlight, then highlight + scroll to `quote` within the
  // currently-rendered page.
  const highlightDom = useCallback((quote: string) => {
    const el = bodyRef.current;
    if (!el) return;
    el.querySelectorAll("mark.bm").forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent?.insertBefore(m.firstChild, m);
      parent?.removeChild(m);
      parent?.normalize();
    });
    const needle = quote.toLowerCase();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue ?? "";
      const idx = text.toLowerCase().indexOf(needle);
      if (idx >= 0) {
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
    }
  }, []);

  // Jump to a bookmark — switching to the page that contains it first, if needed.
  const jumpTo = useCallback(
    (quote: string) => {
      const needle = quote.toLowerCase();
      let target = -1;
      for (let i = 0; i < pages.length; i++) {
        if (stripTags(pages[i]).toLowerCase().includes(needle)) {
          target = i;
          break;
        }
      }
      if (target >= 0 && target !== safePage) {
        setFlipDir(null);
        setPage(target);
        setTimeout(() => highlightDom(quote), 80);
      } else {
        highlightDom(quote);
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
    if (latest) setTimeout(() => jumpTo(latest.quote), 150);
  }, [autoResume, bookmarks, clampedInitial, jumpTo]);

  function onMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString().trim().replace(/\s+/g, " ") ?? "";
    if (!text || !selection || selection.isCollapsed || !bodyRef.current) {
      return;
    }
    if (!bodyRef.current.contains(selection.anchorNode)) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSel({ top: rect.top - 44, left: rect.left, text: text.slice(0, 300) });
  }

  async function addBookmark() {
    if (!sel) return;
    const quote = sel.text;
    setSel(null);
    // Don't add a duplicate — if this exact text is already bookmarked in this
    // chapter, just jump to the existing one.
    const dupe = bookmarks.find(
      (b) =>
        b.chapter_index === current &&
        b.quote.trim().toLowerCase() === quote.trim().toLowerCase(),
    );
    if (dupe) {
      window.getSelection()?.removeAllRanges();
      jumpTo(dupe.quote);
      return;
    }
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, chapterIndex: current, quote }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookmarks((prev) => [
        ...prev,
        { id: data.id, chapter_index: current, quote: data.quote },
      ]);
      window.getSelection()?.removeAllRanges();
      jumpTo(quote);
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
                        onClick={() => jumpTo(b.quote)}
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
                  ref={bodyRef}
                  onMouseUp={onMouseUp}
                  className={
                    "richtext text-lg text-zinc-800 dark:text-zinc-200 " +
                    (flipDir === "next"
                      ? "pageflip-next"
                      : flipDir === "prev"
                        ? "pageflip-prev"
                        : "")
                  }
                  dangerouslySetInnerHTML={{ __html: pages[safePage] ?? "" }}
                />
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
