"use client";

import { useState } from "react";

// Share the current collection. Uses the native share sheet when available
// (mobile), otherwise offers copy-link plus quick links to common networks.
export function ShareCollection({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function url() {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  async function share() {
    const link = url();
    const data = { title: name, text: `Check out this collection on Talerooms: ${name}`, url: link };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled — fall through to the menu */
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const encoded = encodeURIComponent(url());
  const text = encodeURIComponent(`Check out this collection on Talerooms: ${name}`);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={share}
        className="flex h-9 items-center gap-2 rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <span aria-hidden="true">↗</span> Share
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={copy}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {copied ? "Link copied ✓" : "Copy link"}
          </button>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Share on Facebook
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Share on LinkedIn
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Share on X
          </a>
          <a
            href={`https://wa.me/?text=${text}%20${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Share on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
