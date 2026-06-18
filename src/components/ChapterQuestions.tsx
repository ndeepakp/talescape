"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type McqQ = {
  id: string;
  type: "mcq";
  prompt: string;
  options: string[];
  counts: number[];
  total: number;
  myChoice: number | null;
};
type OpenQ = {
  id: string;
  type: "open";
  prompt: string;
  answers: { answer: string; author: string | null; handle: string | null; mine: boolean }[];
  myAnswer: string | null;
};
type Q = McqQ | OpenQ;

function McqItem({
  q,
  storyId,
  chapterIndex,
  reload,
}: {
  q: McqQ;
  storyId: string;
  chapterIndex: number;
  reload: () => void;
}) {
  const answered = q.myChoice !== null;
  async function pick(i: number) {
    const res = await fetch(`/api/stories/${storyId}/qna`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIndex, questionId: q.id, choice: i }),
    });
    if (res.ok) reload();
  }
  return (
    <div>
      <p className="font-medium text-zinc-800 dark:text-zinc-200">{q.prompt}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {q.options.map((opt, i) => {
          const pct = q.total ? Math.round((q.counts[i] / q.total) * 100) : 0;
          const selected = q.myChoice === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              className={
                "relative overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                (selected
                  ? "border-accent"
                  : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900")
              }
            >
              {answered && (
                <span
                  className="absolute inset-y-0 left-0 bg-accent/15"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-zinc-800 dark:text-zinc-200">
                  {opt}
                  {selected && " ✓"}
                </span>
                {answered && <span className="text-xs text-zinc-500">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="mt-1 text-xs text-zinc-400">
          {q.total} {q.total === 1 ? "response" : "responses"}
        </p>
      )}
    </div>
  );
}

function OpenItem({
  q,
  storyId,
  chapterIndex,
  reload,
}: {
  q: OpenQ;
  storyId: string;
  chapterIndex: number;
  reload: () => void;
}) {
  const [draft, setDraft] = useState(q.myAnswer ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    const res = await fetch(`/api/stories/${storyId}/qna`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIndex, questionId: q.id, answer: text }),
    });
    setBusy(false);
    if (res.ok) reload();
  }
  return (
    <div>
      <p className="font-medium text-zinc-800 dark:text-zinc-200">{q.prompt}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Your answer…"
          className="flex-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !draft.trim()}
          className="rounded-full btn-primary px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {q.myAnswer ? "Update" : "Answer"}
        </button>
      </div>
      {q.answers.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {q.answers.map((a, i) => (
            <li key={i} className="text-sm">
              <Link
                href={`/${a.handle ?? ""}`}
                className="font-medium text-zinc-800 hover:underline dark:text-zinc-200"
              >
                {a.author ?? "Reader"}
              </Link>
              <span className="text-zinc-400">: </span>
              <span className="whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">
                {a.answer}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChapterQuestions({
  storyId,
  chapterIndex,
}: {
  storyId: string;
  chapterIndex: number;
}) {
  const [questions, setQuestions] = useState<Q[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stories/${storyId}/qna?chapter=${chapterIndex}`);
    if (res.ok) setQuestions((await res.json()).questions as Q[]);
  }, [storyId, chapterIndex]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      load();
    });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  if (!questions || questions.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Questions for this chapter
      </h4>
      <div className="mt-3 flex flex-col gap-5">
        {questions.map((q) =>
          q.type === "mcq" ? (
            <McqItem key={q.id} q={q} storyId={storyId} chapterIndex={chapterIndex} reload={load} />
          ) : (
            <OpenItem key={q.id} q={q} storyId={storyId} chapterIndex={chapterIndex} reload={load} />
          ),
        )}
      </div>
    </section>
  );
}
