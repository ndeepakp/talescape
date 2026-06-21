"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCY, formatPrice } from "@/lib/pricing";

// Subscribe / unsubscribe to an author (mock checkout, 30-day term).
//   - Not subscribed → a Subscribe button that runs the mock payment.
//   - Subscribed     → a status pill + Unsubscribe. No payment is triggered
//     while a subscription is active.
//   - Cancelled but still in the paid period → keeps access until it lapses,
//     with a Resume option (no new charge).
export function SubscribeButton({
  authorId,
  price,
  initialDaysLeft,
  initialCancelled,
}: {
  authorId: string;
  price: number;
  initialDaysLeft: number | null;
  initialCancelled: boolean;
}) {
  const router = useRouter();
  const [daysLeft, setDaysLeft] = useState(initialDaysLeft);
  const [cancelled, setCancelled] = useState(initialCancelled);
  const [loading, setLoading] = useState(false);
  const active = daysLeft !== null && daysLeft > 0;

  async function subscribe() {
    // No payment prompt while access is still active (e.g. resuming a cancel).
    if (!active) {
      if (!window.confirm(`Mock payment: subscribe for ${formatPrice(price)} / 30 days?`)) {
        return;
      }
    }
    setLoading(true);
    const res = await fetch(`/api/users/${authorId}/subscribe`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      if (!active) setDaysLeft(30);
      setCancelled(false);
      router.refresh();
    }
  }

  async function unsubscribe() {
    if (
      !window.confirm(
        "Unsubscribe? You'll keep access until your current period ends, but it won't renew.",
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/users/${authorId}/subscribe`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      setCancelled(true);
      router.refresh();
    }
  }

  if (active) {
    return (
      <div className="flex flex-col items-end gap-1">
        {cancelled ? (
          <>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Access for {daysLeft}d · won&apos;t renew
            </span>
            <button
              type="button"
              onClick={subscribe}
              disabled={loading}
              className="text-xs text-zinc-500 underline hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
            >
              Resume subscription
            </button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Subscribed · {daysLeft}d left
            </span>
            <button
              type="button"
              onClick={unsubscribe}
              disabled={loading}
              className="text-xs text-zinc-500 underline hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
            >
              Unsubscribe
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={loading}
      className="h-10 rounded-full btn-primary px-5 text-sm font-medium transition-colors disabled:opacity-50"
    >
      Subscribe · {CURRENCY}
      {price}/30d
    </button>
  );
}
