"use client";

import { useEffect, useState } from "react";
import { MiniBarChart, type ChartPoint } from "@/components/profile/MiniBarChart";
import { CURRENCY } from "@/lib/pricing";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

type Data = {
  views: ChartPoint[];
  purchases: ChartPoint[];
  earnings: ChartPoint[];
  subscribers: number;
};

const EMPTY: Data = { views: [], purchases: [], earnings: [], subscribers: 0 };

function total(pts: ChartPoint[]) {
  return pts.reduce((s, p) => s + p.value, 0);
}

// Author analytics with a clickable day-range selector. Refetches when the
// range changes.
export function AnalyticsPanel() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  // Bumped to force a refetch (e.g. when returning to the tab).
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // no-store so the browser never serves a stale cached copy after a
      // purchase / subscription happens elsewhere.
      const res = await fetch(`/api/me/analytics?days=${days}`, { cache: "no-store" });
      if (!active) return;
      if (res.ok) setData((await res.json()) as Data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [days, reload]);

  // Refresh whenever the user comes back to this tab/window.
  useEffect(() => {
    const onFocus = () => setReload((r) => r + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Which graph is opened in the expanded view (by title), if any.
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cards: { title: string; pts: ChartPoint[]; fmt?: (n: number) => string; total: string }[] = [
    { title: "Views", pts: data.views, total: String(total(data.views)) },
    { title: "Purchases", pts: data.purchases, total: String(total(data.purchases)) },
    {
      title: "Earnings",
      pts: data.earnings,
      fmt: (n) => `${CURRENCY}${n}`,
      total: `${CURRENCY}${total(data.earnings)}`,
    },
  ];

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Analytics
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Views, purchases and earnings across your stories ·{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              {data.subscribers}
            </strong>{" "}
            active {data.subscribers === 1 ? "subscriber" : "subscribers"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (days === r.days
                  ? "chip-active"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReload((r) => r + 1)}
            aria-label="Refresh"
            title="Refresh"
            className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            ↻
          </button>
        </div>
      </div>

      <div className={"mt-4 grid gap-4 sm:grid-cols-3 " + (loading ? "opacity-60" : "")}>
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => setExpanded(c.title)}
            title="Click to expand"
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {c.title}
              </span>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {c.total}
              </span>
            </div>
            <div className="mt-3">
              {c.pts.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
                  {loading ? "Loading…" : "No data"}
                </div>
              ) : (
                <MiniBarChart data={c.pts} format={c.fmt} />
              )}
            </div>
            <p className="mt-2 text-right text-[10px] text-zinc-400">Click to expand ⤢</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Earnings are mocked for now — they reflect the prices readers would have paid.
      </p>

      {/* Expanded graph overlay */}
      {expanded &&
        (() => {
          const c = cards.find((card) => card.title === expanded);
          if (!c) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
              onClick={() => setExpanded(null)}
            >
              <div
                className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {c.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Last {days} days · total{" "}
                      <strong className="text-zinc-700 dark:text-zinc-300">{c.total}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(null)}
                    aria-label="Close"
                    className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-6">
                  {c.pts.length === 0 ? (
                    <div className="flex h-80 items-center justify-center text-sm text-zinc-400">
                      No data
                    </div>
                  ) : (
                    <MiniBarChart data={c.pts} format={c.fmt} large />
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
