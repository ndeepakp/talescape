import { type ShelfStyle } from "@/lib/appearance";

// Plank colours per finish (the surface highlight + the darker front face),
// mirroring the light-mode gradients in globals.css. Used to render a small
// live preview next to the shelf picker in Settings.
const FINISH: Record<ShelfStyle, { top: string; face: string }> = {
  walnut: { top: "#c2995a", face: "#8a6630" },
  oak: { top: "#dcbb72", face: "#ad8438" },
  ebony: { top: "#3e3833", face: "#201c19" },
  minimal: { top: "#e2dfd8", face: "#bdb9b0" },
};

// A few mini "books" standing on the plank.
const BOOKS = [
  { bg: "#6366f1", br: "#4f46e5", h: 38 },
  { bg: "#1d9e75", br: "#0f6e56", h: 30 },
  { bg: "#f43f5e", br: "#e11d48", h: 34 },
];

// Small bookshelf preview that re-renders with the currently-selected finish.
export function ShelfPreview({ shelf }: { shelf: ShelfStyle }) {
  const f = FINISH[shelf];
  return (
    <div
      aria-hidden="true"
      className="flex w-[108px] shrink-0 flex-col justify-end rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="flex items-end justify-center gap-1.5" style={{ height: 40 }}>
        {BOOKS.map((b, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: b.h,
              background: b.bg,
              border: `1.5px solid ${b.br}`,
              borderRadius: "1px 2px 2px 1px",
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 9,
          borderRadius: "0 0 2px 2px",
          background: `linear-gradient(to bottom, ${f.top} 0, ${f.top} 3.5px, ${f.face} 3.5px, ${f.face} 9px)`,
          boxShadow: "0 2px 5px rgba(40,25,5,0.28)",
        }}
      />
    </div>
  );
}
