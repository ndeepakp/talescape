"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestions = {
  genres: { id: number; name: string }[];
  users: { id: string; name: string | null; username: string | null }[];
  stories: { id: string; title: string; author: string | null }[];
};

const EMPTY: Suggestions = { genres: [], users: [], stories: [] };

export function SearchBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Suggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounce: wait until the reader pauses typing before asking the server.
  // The empty-query reset lives in the input's onChange (an event handler), not
  // here, so the effect never calls setState synchronously.
  useEffect(() => {
    const term = q.trim();
    if (term.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as Suggestions;
      if (!cancelled) {
        setResults(data);
        setOpen(true);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) go(`/search?q=${encodeURIComponent(term)}`);
  }

  const hasResults =
    results.genres.length + results.users.length + results.stories.length > 0;

  return (
    <div className="relative" ref={ref}>
      <form onSubmit={submit}>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            // Clear stale suggestions immediately when the box is emptied.
            if (value.trim().length === 0) {
              setResults(EMPTY);
              setOpen(false);
            }
          }}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search stories or $handles…"
          className="h-11 w-full rounded-full border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
        />
      </form>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No matches.</p>
          ) : (
            <>
              {results.genres.length > 0 && (
                <Group label="Genres">
                  {results.genres.map((g) => (
                    <Row key={`g-${g.id}`} onClick={() => go(`/genres/${g.id}`)}>
                      <span className="text-zinc-900 dark:text-zinc-100">{g.name}</span>
                    </Row>
                  ))}
                </Group>
              )}
              {results.users.length > 0 && (
                <Group label="People">
                  {results.users.map((u) => (
                    <Row key={`u-${u.id}`} onClick={() => go(`/${u.username ?? u.id}`)}>
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {u.name ?? "Unknown"}
                      </span>
                      {u.username && (
                        <span className="ml-2 text-zinc-500">${u.username}</span>
                      )}
                    </Row>
                  ))}
                </Group>
              )}
              {results.stories.length > 0 && (
                <Group label="Stories">
                  {results.stories.map((s) => (
                    <Row key={`s-${s.id}`} onClick={() => go(`/stories/${s.id}`)}>
                      <span className="text-zinc-900 dark:text-zinc-100">{s.title}</span>
                      <span className="ml-2 text-zinc-500">by {s.author ?? "Unknown"}</span>
                    </Row>
                  ))}
                </Group>
              )}
            </>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
            className="block w-full border-t border-zinc-100 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            See all results for “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="block w-full truncate px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}
