"use client";

import { type Question } from "@/lib/story-validation";

function qid(): string {
  return `q-${Math.random().toString(36).slice(2, 10)}`;
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// Author editor for a chapter's engagement questions (open or multiple-choice).
export function ChapterQuestionsEditor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (q: Question[]) => void;
}) {
  function update(i: number, patch: Partial<Question>) {
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function add(type: "open" | "mcq") {
    onChange([
      ...questions,
      { id: qid(), type, prompt: "", options: type === "mcq" ? ["", ""] : [] },
    ]);
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Reader Q&amp;A <span className="font-normal text-zinc-400">(optional)</span>
      </span>
      <p className="text-xs text-zinc-400">
        Engage readers after this chapter — answers are public.
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <select
                value={q.type}
                onChange={(e) =>
                  update(i, {
                    type: e.target.value as "open" | "mcq",
                    options:
                      e.target.value === "mcq" && q.options.length < 2
                        ? ["", ""]
                        : q.options,
                  })
                }
                className={inputCls + " h-8"}
              >
                <option value="open">Open answer</option>
                <option value="mcq">Multiple choice</option>
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Remove
              </button>
            </div>
            <input
              value={q.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              placeholder="Your question…"
              className={inputCls + " mt-2 h-9 w-full"}
            />
            {q.type === "mcq" && (
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      value={o}
                      onChange={(e) =>
                        update(i, {
                          options: q.options.map((opt, idx) =>
                            idx === oi ? e.target.value : opt,
                          ),
                        })
                      }
                      placeholder={`Option ${oi + 1}`}
                      className={inputCls + " h-8 flex-1"}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          update(i, {
                            options: q.options.filter((_, idx) => idx !== oi),
                          })
                        }
                        className="text-xs text-zinc-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 8 && (
                  <button
                    type="button"
                    onClick={() => update(i, { options: [...q.options, ""] })}
                    className="self-start text-xs font-medium text-accent hover:underline"
                  >
                    + Add option
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => add("open")}
            className="text-xs font-medium text-accent hover:underline"
          >
            + Open question
          </button>
          <button
            type="button"
            onClick={() => add("mcq")}
            className="text-xs font-medium text-accent hover:underline"
          >
            + Multiple choice
          </button>
        </div>
      </div>
    </div>
  );
}
