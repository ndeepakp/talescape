"use client";

import { useState } from "react";
import Link from "next/link";

type Resume = {
  story_id: string;
  title: string;
  author: string | null;
  chapter_index: number;
};

// The "Continue reading" card, dismissible via the ✕. Dismissal is stored in a
// cookie (not localStorage) so the SERVER can see it and skip rendering the card
// — avoiding the flash where it appears then disappears on every reload. It
// comes back once the reader progresses to a different chapter (new cookie key).
export function ContinueReading({ resume }: { resume: Resume }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    document.cookie = `resume_dismissed=${resume.story_id}:${resume.chapter_index}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setHidden(true);
  }

  return (
    <div className="relative mt-4">
      <Link
        href={`/stories/${resume.story_id}?chapter=${resume.chapter_index}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-accent bg-accent/5 p-4 pr-12 transition-colors hover:bg-accent/10"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Continue reading
          </p>
          <p className="mt-0.5 truncate font-semibold text-zinc-900 dark:text-zinc-50">
            {resume.title}
          </p>
          <p className="text-sm text-zinc-500">
            Chapter {resume.chapter_index + 1} · by {resume.author ?? "Unknown"}
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full btn-primary px-4 py-2 text-sm font-medium sm:inline-block">
          Continue from there →
        </span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss continue reading"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        ✕
      </button>
    </div>
  );
}
