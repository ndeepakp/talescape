"use client";

import { useState, type ReactNode } from "react";

export type SideTab = {
  key: string;
  label: string;
  icon?: string;
  count?: number;
  content: ReactNode;
};

// A left-side tab rail (vertical on desktop, a top segmented toggle on mobile)
// that switches the main content. Used on the feed and profiles to flip between
// Stories and Posts.
export function SideTabs({ tabs }: { tabs: SideTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="mt-6 flex flex-col gap-6 md:flex-row">
      <nav className="flex gap-2 md:w-44 md:shrink-0 md:flex-col md:self-start">
        {tabs.map((t) => {
          const on = t.key === current?.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-current={on ? "page" : undefined}
              className={
                "flex flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors md:flex-initial " +
                (on
                  ? "btn-primary"
                  : "border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
            >
              {t.icon && <span aria-hidden="true">{t.icon}</span>}
              <span>{t.label}</span>
              {typeof t.count === "number" && (
                <span className={"ml-auto text-xs " + (on ? "opacity-80" : "text-zinc-400")}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">{current?.content}</div>
    </div>
  );
}
