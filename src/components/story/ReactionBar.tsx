"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReactionBar({
  storyId,
  initialLikes,
  initialDislikes,
  initialUserReaction,
  isLoggedIn,
}: {
  storyId: string;
  initialLikes: number;
  initialDislikes: number;
  initialUserReaction: number | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [reaction, setReaction] = useState<number | null>(initialUserReaction);
  const [loading, setLoading] = useState(false);

  async function react(value: 1 | -1) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/stories/${storyId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setDislikes(data.dislikes);
      setReaction(data.userReaction);
    }
  }

  const base =
    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const idle =
    "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

  return (
    <div className="flex gap-3">
      <button
        onClick={() => react(1)}
        disabled={loading}
        aria-pressed={reaction === 1}
        className={
          base +
          " " +
          (reaction === 1
            ? "border-green-600 bg-green-600 text-white"
            : idle)
        }
      >
        <span aria-hidden>▲</span> Like <span className="tabular-nums">{likes}</span>
      </button>
      <button
        onClick={() => react(-1)}
        disabled={loading}
        aria-pressed={reaction === -1}
        className={
          base +
          " " +
          (reaction === -1
            ? "border-red-600 bg-red-600 text-white"
            : idle)
        }
      >
        <span aria-hidden>▼</span> Dislike <span className="tabular-nums">{dislikes}</span>
      </button>
    </div>
  );
}
