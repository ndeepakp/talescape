"use client";

import { useEffect, useRef, useState } from "react";

type Collection = { id: string; name: string; count: number; contains: boolean };

// "Save to collection" control on a story page. Opens a menu of the reader's
// collections (toggle the story in/out) plus a field to create a new one.
export function SaveToCollection({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function load() {
    const res = await fetch(`/api/collections?storyId=${storyId}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items as Collection[]);
    setLoaded(true);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  }

  async function toggle(c: Collection) {
    const method = c.contains ? "DELETE" : "POST";
    const res = await fetch(`/api/collections/${c.id}/stories`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, contains: !c.contains, count: x.count + (c.contains ? -1 : 1) }
            : x,
        ),
      );
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, storyId }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [
        { id: data.id, name: data.name, count: 1, contains: true },
        ...prev,
      ]);
      setNewName("");
    }
  }

  const savedCount = items.filter((c) => c.contains).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex h-10 items-center gap-2 rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <span aria-hidden="true">＋</span>
        {loaded && savedCount > 0 ? `Saved (${savedCount})` : "Save to collection"}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
            Save to collection
          </div>

          {!loaded ? (
            <p className="px-4 py-4 text-center text-sm text-zinc-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-zinc-500">
              No collections yet — create one below.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                      {c.name}{" "}
                      <span className="text-xs text-zinc-400">({c.count})</span>
                    </span>
                    <span className={c.contains ? "text-accent" : "text-zinc-300 dark:text-zinc-600"}>
                      {c.contains ? "✓" : "＋"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 border-t border-zinc-100 p-2 dark:border-zinc-800">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              placeholder="New collection…"
              maxLength={80}
              className="h-9 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={createAndAdd}
              disabled={busy || !newName.trim()}
              className="h-9 rounded-lg btn-primary px-3 text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
