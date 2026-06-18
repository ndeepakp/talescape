import { COVER_PALETTES, type CoverStyle } from "@/lib/cover-style";

// Renders a story's cover, in precedence order: an uploaded image, then a
// generated designed-template cover, then a generic placeholder. `className`
// sets the size/shape (e.g. "h-40 w-28 rounded-md"); BookCover adds the look.
export function BookCover({
  title,
  author,
  coverUrl,
  coverStyle,
  className = "",
}: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  coverStyle?: CoverStyle | null;
  className?: string;
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`Cover of ${title}`}
        className={`${className} border-2 border-accent object-cover`}
      />
    );
  }

  if (coverStyle) {
    const pal = COVER_PALETTES[coverStyle.palette % COVER_PALETTES.length];
    return (
      <div
        role="img"
        aria-label={`Cover of ${title}`}
        className={`${className} flex flex-col items-center justify-between overflow-hidden border-2 border-accent p-3 text-center`}
        style={{ background: pal.bg, color: pal.fg }}
      >
        <span
          className="mt-1 block h-1 w-8 rounded-full"
          style={{ background: pal.accent }}
        />
        <span
          className="font-serif text-sm font-semibold leading-tight"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </span>
        <span className="block w-full truncate text-[10px] uppercase tracking-wide opacity-80">
          {author ?? ""}
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Cover of ${title}`}
      className={`${className} flex items-center justify-center border-2 border-accent bg-zinc-100 text-3xl text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600`}
    >
      📖
    </div>
  );
}
