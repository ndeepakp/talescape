"use client";

import { useEffect, useRef, useState } from "react";

// Best-effort screenshot deterrent for the story reader. Two layers:
//
//  1. A faint, tiled per-reader watermark ("@handle · <time>") laid over the
//     reading area. It does NOT stop a screenshot — its job is to make every
//     leaked screenshot traceable back to the account that took it, which is the
//     only thing that actually deters sharing on the web.
//
//  2. A black-out overlay triggered by the (weak) signals a browser can see:
//     the PrintScreen key, the window losing focus, or the tab being hidden.
//     This catches the naive PrintScreen / snipping-tool case only — the browser
//     is never told about Cmd+Shift+4, Win+Shift+S, or a phone's screenshot
//     gesture, and nothing stops someone photographing the screen with another
//     device. We blank optimistically and reveal again on return.
//
// `label` is the reader's identifier (e.g. "@handle"); the timestamp is stamped
// client-side at mount so the watermark reflects when this view happened.
export function ReaderShield({ label }: { label: string }) {
  const [blanked, setBlanked] = useState(false);
  // A short hold so a momentary blur (e.g. clicking the snip tool) doesn't flash
  // the content back the instant focus returns mid-capture.
  const holdUntil = useRef(0);

  useEffect(() => {
    const blank = (holdMs = 0) => {
      holdUntil.current = Math.max(holdUntil.current, Date.now() + holdMs);
      setBlanked(true);
    };
    const reveal = () => {
      if (Date.now() < holdUntil.current) return;
      setBlanked(false);
    };

    const onKey = (e: KeyboardEvent) => {
      // PrintScreen, or a Cmd/Win+Shift combo (macOS / Windows snip shortcuts).
      const combo = e.shiftKey && (e.metaKey || e.getModifierState?.("Meta"));
      if (e.key === "PrintScreen" || combo) {
        blank(1500);
        setTimeout(reveal, 1500);
      }
    };
    const onBlur = () => blank();
    const onVisibility = () => (document.hidden ? blank() : reveal());

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", reveal);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", reveal);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // Timestamp the watermark once at mount (local time, minute precision).
  const [stamp] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  });
  const text = `${label} · ${stamp}`;

  // Tiled diagonal watermark as an inline SVG background. Gray with low alpha so
  // it sits faintly over both light and dark themes but still shows on a capture.
  const tile = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'>` +
      `<text x='10' y='110' fill='rgba(128,128,128,0.16)' font-family='system-ui,sans-serif' ` +
      `font-size='15' font-weight='600' transform='rotate(-28 170 100)'>${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</text></svg>`,
  );

  return (
    <>
      {/* Traceable watermark — covers the reading area, never intercepts clicks. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 select-none bg-repeat"
        style={{ backgroundImage: `url("data:image/svg+xml,${tile}")` }}
      />

      {/* Best-effort black-out on a detected capture attempt. */}
      {blanked && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-6 text-center text-sm text-zinc-500"
        >
          Hidden to protect the author’s work.
        </div>
      )}
    </>
  );
}
