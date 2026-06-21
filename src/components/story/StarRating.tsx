// Read-only star rating display with fractional fill (e.g. 4.3 ★). Pure
// component (no hooks) so it works in server and client components.

export const STAR_PATH =
  "M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.169L12 18.896l-7.335 3.867 1.401-8.169L.132 9.21l8.2-1.192z";

export function StarSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%" className={className}>
      <path d={STAR_PATH} />
    </svg>
  );
}

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 align-middle"
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: size, height: size }}
            aria-hidden="true"
          >
            <span className="absolute inset-0 text-zinc-300 dark:text-zinc-600">
              <StarSvg />
            </span>
            <span
              className="absolute inset-0 overflow-hidden text-amber-400"
              style={{ width: `${fill * 100}%` }}
            >
              <StarSvg />
            </span>
          </span>
        );
      })}
    </span>
  );
}
