"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Author-only control to feature (pin) or unpin a review.
export function PinReviewButton({
  reviewId,
  pinned,
}: {
  reviewId: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/reviews/${reviewId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error ?? "Could not update the pin.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {pinned ? "Unpin" : "📌 Feature"}
    </button>
  );
}
