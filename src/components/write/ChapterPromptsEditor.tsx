"use client";

import { MAX_PROMPTS } from "@/lib/story-validation";

const inputCls =
  "h-9 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// Author editor for a chapter's open discussion prompts. A reader's answer to a
// prompt becomes a public post (handled at read time), so these are free-text.
export function ChapterPromptsEditor({
  prompts,
  onChange,
}: {
  prompts: string[];
  onChange: (p: string[]) => void;
}) {
  function update(i: number, val: string) {
    onChange(prompts.map((p, idx) => (idx === i ? val : p)));
  }
  function add() {
    onChange([...prompts, ""]);
  }
  function remove(i: number) {
    onChange(prompts.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Discussion prompts <span className="font-normal text-zinc-400">(optional)</span>
      </span>
      <p className="text-xs text-zinc-400">
        Open questions for readers — a reader’s answer becomes a public post on
        the feed, and you’re notified.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {prompts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={p}
              onChange={(e) => update(i, e.target.value)}
              maxLength={280}
              placeholder="e.g. What would you have done in their place?"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-zinc-400 hover:text-red-600"
              aria-label="Remove prompt"
            >
              ✕
            </button>
          </div>
        ))}
        {prompts.length < MAX_PROMPTS && (
          <button
            type="button"
            onClick={add}
            className="self-start text-xs font-medium text-accent hover:underline"
          >
            + Add discussion prompt
          </button>
        )}
      </div>
    </div>
  );
}
