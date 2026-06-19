import { COVER_PALETTES, defaultPalette, type CoverStyle } from "@/lib/cover-style";

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

  // No uploaded image → always show a designed, colourful generated cover. Use
  // the story's chosen palette, or derive a stable one from the title so every
  // coverless story still gets an on-brand, varied cover (never a blank box).
  const paletteIndex = (coverStyle ?? { palette: defaultPalette(title) }).palette;
  const pal = COVER_PALETTES[paletteIndex % COVER_PALETTES.length];
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
