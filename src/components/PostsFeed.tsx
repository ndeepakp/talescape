"use client";

import { useState } from "react";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import type { PostRow } from "@/lib/posts";

function chipCls(on: boolean): string {
  return (
    "rounded-full px-3 py-1 text-sm font-medium transition-colors " +
    (on
      ? "chip-active"
      : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
  );
}

// The feed's Posts tab: composer + an All / Mentioned filter + the list.
export function PostsFeed({ posts }: { posts: PostRow[] }) {
  const [filter, setFilter] = useState<"all" | "mentioned">("all");
  const shown = filter === "mentioned" ? posts.filter((p) => p.mentions_me) : posts;

  return (
    <div className="flex flex-col gap-4">
      <PostComposer />
      <div className="flex gap-2">
        <button type="button" onClick={() => setFilter("all")} className={chipCls(filter === "all")}>
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("mentioned")}
          className={chipCls(filter === "mentioned")}
        >
          Mentioned
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {filter === "mentioned"
            ? "No posts mention you yet."
            : "No posts yet — start the conversation."}
        </p>
      ) : (
        shown.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
