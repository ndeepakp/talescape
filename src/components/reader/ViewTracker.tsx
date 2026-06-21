"use client";

import { useEffect } from "react";

// Fire-and-forget view ping when a reader opens a story. Renders nothing.
// The server dedupes to one view per day and ignores the author's own views.
export function ViewTracker({ storyId }: { storyId: string }) {
  useEffect(() => {
    fetch(`/api/stories/${storyId}/view`, { method: "POST" }).catch(() => {});
  }, [storyId]);
  return null;
}
