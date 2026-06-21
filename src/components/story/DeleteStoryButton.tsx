"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteStoryButton({
  storyId,
  redirectTo,
}: {
  storyId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this story? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
    if (!res.ok) {
      setLoading(false);
      alert("Could not delete the story.");
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
