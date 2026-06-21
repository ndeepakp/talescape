"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MentionInput } from "@/components/post/MentionInput";

export function PostComposer({
  placeholder = "Share something about stories… type @ to tag a person or story",
  attachStory,
  answer,
  onPosted,
}: {
  placeholder?: string;
  // When set, the post is automatically linked to this story (shown as a chip,
  // and the story link token is prepended to the body on submit).
  attachStory?: { id: string; slug?: string | null; title: string };
  // When set, the post is a reader's answer to a chapter's discussion prompt —
  // it's tagged with the story/chapter/prompt (no story link token needed).
  answer?: { storyId: string; chapterIndex: number; prompt: string };
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const fullBody =
      attachStory && !answer
        ? `[${attachStory.title}](/stories/${attachStory.slug ?? attachStory.id}) ${body}`
        : body;
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: fullBody,
        ...(answer
          ? {
              answerStoryId: answer.storyId,
              answerChapter: answer.chapterIndex,
              answerPrompt: answer.prompt,
            }
          : {}),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      onPosted?.();
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not post.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {answer ? (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <span aria-hidden="true">💬</span>
          Answering: “{answer.prompt}”
        </p>
      ) : (
        attachStory && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <span aria-hidden="true">📖</span>
            About “{attachStory.title}”
          </p>
        )
      )}
      <MentionInput
        value={body}
        onChange={setBody}
        rows={3}
        maxLength={2000}
        placeholder={answer ? "Write your answer… type @ to tag someone" : placeholder}
        className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !body.trim()}
          className="rounded-full btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {answer ? "Post answer" : "Post"}
        </button>
      </div>
    </div>
  );
}
