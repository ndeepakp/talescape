"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol, TIER_LABELS, formatPrice, type Tier } from "@/lib/pricing";

type PriceMap = Partial<Record<Tier, number>>;
type ChapterOption = {
  index: number;
  title: string;
  prices: PriceMap;
  owned: boolean;
};

// Reader-facing buy flow for a story's private chapters. MOCK checkout — no real
// money moves; on success the server records the grant and the page re-renders
// with the unlocked content.
export function AccessPanel({
  storyId,
  offered,
  wholePrices,
  chapters,
  currency,
}: {
  storyId: string;
  offered: Tier[];
  wholePrices: PriceMap;
  chapters: ChapterOption[];
  currency: string;
}) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>(offered[0]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (offered.length === 0) return null;

  const wholePrice = wholePrices[tier];
  const wholeAvailable = typeof wholePrice === "number";
  const lockedForTier = chapters.filter(
    (c) => !c.owned && typeof c.prices[tier] === "number",
  );
  const chaptersTotal = lockedForTier
    .filter((c) => picked.has(c.index))
    .reduce((s, c) => s + (c.prices[tier] as number), 0);

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function buy(payload: object, total: number) {
    if (!window.confirm(`Mock payment: pay ${formatPrice(total, currency)} for this access?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/stories/${storyId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not complete the purchase.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Get access to the chapters
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Pick how long you want access for, then buy the whole story or just the
        chapters you want. (Payments are mocked for now — nothing is charged.)
      </p>

      {/* Duration choice */}
      <div className="mt-4">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Access duration
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {offered.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (t === tier
                  ? "chip-active"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Whole-story bundle */}
      {wholeAvailable && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Whole story
            </p>
            <p className="text-sm text-zinc-500">
              All chapters, including any added later, for {TIER_LABELS[tier].toLowerCase()}.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => buy({ scope: "whole", duration: tier }, wholePrice as number)}
            className="shrink-0 rounded-full btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {formatPrice(wholePrice as number, currency)}
          </button>
        </div>
      )}

      {/* Per-chapter */}
      {lockedForTier.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Or buy chapters individually
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {lockedForTier.map((c) => (
              <li key={c.index}>
                <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={picked.has(c.index)}
                    onChange={() => togglePick(c.index)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                    {c.title || `Chapter ${c.index + 1}`}
                  </span>
                  <span className="text-zinc-500">
                    {formatPrice(c.prices[tier] as number, currency)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() =>
              buy(
                { scope: "chapters", duration: tier, chapterIndexes: [...picked] },
                chaptersTotal,
              )
            }
            className="mt-3 rounded-full btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Buy {picked.size > 0 ? `${picked.size} ` : ""}selected · {currencySymbol(currency)}
            {chaptersTotal}
          </button>
        </div>
      )}

      {!wholeAvailable && lockedForTier.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500">
          Nothing is for sale at this duration — try another.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
