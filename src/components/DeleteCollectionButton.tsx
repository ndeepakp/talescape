"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCollectionButton({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this collection? The stories themselves aren't affected.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/collections");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      Delete collection
    </button>
  );
}
