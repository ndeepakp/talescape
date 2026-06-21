"use client";

import { useState } from "react";
import { PostComposer } from "@/components/post/PostComposer";

// Reader-facing discussion prompts for a chapter. Answering one opens the post
// composer (tagged with this story + chapter + prompt); the answer becomes a
// public post on the feed and notifies the author.
export function ChapterPrompts({
  storyId,
  chapterIndex,
  prompts,
}: {
  storyId: string;
  chapterIndex: number;
  prompts: string[];
}) {
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  if (!prompts || prompts.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Join the discussion
      </h4>
      <p className="text-xs text-zinc-400">
        Your answer becomes a public post on the feed.
      </p>
      <div className="mt-3 flex flex-col gap-4">
        {prompts.map((p, i) => (
          <div key={i}>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p}</p>
            {done[p] ? (
              <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Posted — find it on the feed.
              </p>
            ) : openPrompt === p ? (
              <div className="mt-2">
                <PostComposer
                  answer={{ storyId, chapterIndex, prompt: p }}
                  onPosted={() => {
                    setDone((d) => ({ ...d, [p]: true }));
                    setOpenPrompt(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setOpenPrompt(null)}
                  className="mt-1 text-xs text-zinc-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenPrompt(p)}
                className="mt-1 rounded-full border border-accent px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
              >
                Answer this →
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
