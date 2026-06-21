"use client";

import { type Question } from "@/lib/story-validation";

function qid(): string {
  return `q-${Math.random().toString(36).slice(2, 10)}`;
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// Author editor for a chapter's graded quiz: multiple-choice questions, each
// with 2–8 options and one marked correct.
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
  function add() {
    onChange([...questions, { id: qid(), prompt: "", options: ["", ""], answer: 0 }]);
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }
  function setOption(i: number, oi: number, val: string) {
    update(i, { options: questions[i].options.map((o, idx) => (idx === oi ? val : o)) });
  }
  function addOption(i: number) {
    update(i, { options: [...questions[i].options, ""] });
  }
  function removeOption(i: number, oi: number) {
    const q = questions[i];
    const options = q.options.filter((_, idx) => idx !== oi);
    // Keep the "correct" pointer valid as options shift.
    let answer = q.answer;
    if (oi === q.answer) answer = 0;
    else if (oi < q.answer) answer = q.answer - 1;
    update(i, { options, answer });
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Quiz <span className="font-normal text-zinc-400">(optional)</span>
      </span>
      <p className="text-xs text-zinc-400">
        Multiple-choice questions for after this chapter — tap the circle to mark
        the correct answer.
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <input
                value={q.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                placeholder="Your question…"
                className={inputCls + " h-9 flex-1"}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Remove
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update(i, { answer: oi })}
                    title="Mark as the correct answer"
                    aria-label="Mark as the correct answer"
                    aria-pressed={q.answer === oi}
                    className={
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors " +
                      (q.answer === oi
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-300 text-transparent hover:border-emerald-400 dark:border-zinc-600")
                    }
                  >
                    ✓
                  </button>
                  <input
                    value={o}
                    onChange={(e) => setOption(i, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                    className={inputCls + " h-8 flex-1"}
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i, oi)}
                      className="text-xs text-zinc-400 hover:text-red-600"
                      aria-label="Remove option"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 8 && (
                <button
                  type="button"
                  onClick={() => addOption(i)}
                  className="self-start text-xs font-medium text-accent hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          + Add quiz question
        </button>
      </div>
    </div>
  );
}
