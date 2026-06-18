"use client";

import { useEffect, useRef, useState } from "react";

type UserHit = { handle: string; name: string | null; image: string | null };
type StoryHit = { id: string; title: string };

// A textarea that autocompletes @people and story titles. Typing "@word" opens a
// dropdown; picking a person inserts "@handle", picking a story inserts a link
// token "[Title](/stories/id)" that PostBody renders as a clickable link.
export function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [tokenStart, setTokenStart] = useState(0);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [stories, setStories] = useState<StoryHit[]>([]);
  const [active, setActive] = useState(0);

  function syncQuery() {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const m = ta.value.slice(0, caret).match(/@([\w]*)$/);
    if (m) {
      setQuery(m[1]);
      setTokenStart(caret - m[0].length);
    } else {
      setQuery(null);
    }
  }

  useEffect(() => {
    if (query === null) return; // dropdown is hidden when there's no @token
    const t = setTimeout(async () => {
      const res = await fetch(`/api/mentions?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users);
        setStories(d.stories);
        setActive(0);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const items: ({ kind: "user"; u: UserHit } | { kind: "story"; s: StoryHit })[] = [
    ...users.map((u) => ({ kind: "user" as const, u })),
    ...stories.map((s) => ({ kind: "story" as const, s })),
  ];

  function insert(text: string) {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, tokenStart);
    const after = ta.value.slice(caret);
    const next = `${before}${text} ${after}`;
    onChange(next);
    setQuery(null);
    const pos = (before + text + " ").length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function pick(i: number) {
    const it = items[i];
    if (!it) return;
    if (it.kind === "user") insert(`@${it.u.handle}`);
    else insert(`[${it.s.title.replace(/[[\]()]/g, "")}](/stories/${it.s.id})`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  }

  const open = query !== null && items.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          syncQuery();
        }}
        onClick={syncQuery}
        onKeyUp={syncQuery}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        className={className}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {users.length > 0 && (
            <li className="px-3 pb-0.5 pt-1 text-xs font-medium text-zinc-400">People</li>
          )}
          {users.map((u, i) => (
            <li key={`u${u.handle}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                className={
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm " +
                  (active === i ? "bg-zinc-100 dark:bg-zinc-800" : "")
                }
              >
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {u.name ?? u.handle}
                </span>
                <span className="text-zinc-400">@{u.handle}</span>
              </button>
            </li>
          ))}
          {stories.length > 0 && (
            <li className="px-3 pb-0.5 pt-1 text-xs font-medium text-zinc-400">Stories</li>
          )}
          {stories.map((s, i) => {
            const idx = users.length + i;
            return (
              <li key={`s${s.id}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(idx)}
                  className={
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm " +
                    (active === idx ? "bg-zinc-100 dark:bg-zinc-800" : "")
                  }
                >
                  <span aria-hidden="true">📖</span>
                  <span className="truncate text-zinc-800 dark:text-zinc-200">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
