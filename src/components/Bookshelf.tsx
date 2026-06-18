"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { StarRating } from "@/components/StarRating";
import { currencySymbol } from "@/lib/pricing";
import { type CoverStyle } from "@/lib/cover-style";

export type BookshelfStory = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string;
  author: string | null;
  author_id: string;
  author_handle: string | null;
  genres: string[];
  rating: number | null;
  rating_count: number;
  views: number;
  cover_url: string | null;
  cover_style: CoverStyle | null;
  chapters_public: boolean;
  whole_prices: Record<string, number>;
  currency: string;
};

// Public "charges" summary for the detail pane. The real buy panel lives on the
// story page; here we just hint free vs paid (and a from-price if there's one).
function charges(s: BookshelfStory): string {
  if (s.chapters_public) return "Free to read";
  const vals = Object.values(s.whole_prices ?? {}).filter(
    (v) => typeof v === "number" && v > 0,
  );
  if (vals.length) return `From ${currencySymbol(s.currency)}${Math.min(...vals)}`;
  return "Paid";
}

function Rating({ s, size = 12 }: { s: BookshelfStory; size?: number }) {
  if (s.rating_count === 0) {
    return <span className="text-xs text-zinc-400">No ratings yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <StarRating value={s.rating ?? 0} size={size} />
      <span className="text-xs text-zinc-500">
        {(s.rating ?? 0).toFixed(1)} ({s.rating_count})
      </span>
    </span>
  );
}

function DetailPane({
  story,
  onClose,
}: {
  story: BookshelfStory;
  onClose: () => void;
}) {
  return (
    <aside className="fixed inset-0 z-40 overflow-y-auto bg-[var(--page)] p-6 md:static md:z-auto md:w-[380px] md:shrink-0 md:overflow-visible md:bg-transparent md:p-0">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-6">
        <button
          type="button"
          onClick={onClose}
          className="mb-3 text-sm text-zinc-500 hover:underline"
        >
          ← Back to shelf
        </button>
        <div className="flex gap-4">
          <BookCover
            title={story.title}
            author={story.author}
            coverUrl={story.cover_url}
            coverStyle={story.cover_style}
            className="h-44 w-32 shrink-0 rounded-md shadow"
          />
          <div className="min-w-0">
            <Link
              href={`/stories/${story.slug ?? story.id}`}
              className="text-lg font-bold leading-tight text-zinc-900 hover:underline dark:text-zinc-50"
            >
              {story.title}
            </Link>
            <p className="mt-0.5 text-sm text-zinc-500">
              by{" "}
              <Link
                href={`/${story.author_handle ?? story.author_id}`}
                className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {story.author ?? "Unknown"}
              </Link>
            </p>
            <Link href={`/stories/${story.slug ?? story.id}/reviews`} className="mt-2 inline-block">
              <Rating s={story} size={13} />
            </Link>
            <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {charges(story)}
            </p>
          </div>
        </div>

        {story.genres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {story.genres.map((name) => (
              <span
                key={name}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {story.summary}
        </p>

        <Link
          href={`/stories/${story.slug ?? story.id}`}
          className="mt-5 inline-flex rounded-full btn-primary px-4 py-2 text-sm font-medium"
        >
          Open to read →
        </Link>
      </div>
    </aside>
  );
}

export function Bookshelf({ stories }: { stories: BookshelfStory[] }) {
  const [selId, setSelId] = useState<string | null>(null);
  const selected = stories.find((s) => s.id === selId) ?? null;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* The shelf (the list of books) on the left — full width until a book is
          opened, then it shares the row with the detail pane on the right. */}
      <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-5">
        {stories.map((s) => (
          <div key={s.id} className="group flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSelId(s.id)}
              aria-label={`Preview ${s.title}`}
              className="text-left"
            >
              <BookCover
                title={s.title}
                author={s.author}
                coverUrl={s.cover_url}
                coverStyle={s.cover_style}
                className={
                  "aspect-[2/3] w-full rounded-md shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-md " +
                  (s.id === selId
                    ? "ring-1 ring-accent ring-offset-2 ring-offset-[var(--page)]"
                    : "")
                }
              />
            </button>
            <div className="min-w-0">
              <Link
                href={`/stories/${s.slug ?? s.id}`}
                className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {s.title}
              </Link>
              <Link
                href={`/${s.author_handle ?? s.author_id}`}
                className="block truncate text-xs text-zinc-500 hover:underline"
              >
                {s.author ?? "Unknown"}
              </Link>
              <Link
                href={`/stories/${s.slug ?? s.id}/reviews`}
                className="mt-0.5 inline-block"
                aria-label="See ratings"
              >
                <Rating s={s} size={11} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {selected && <DetailPane story={selected} onClose={() => setSelId(null)} />}
    </div>
  );
}
