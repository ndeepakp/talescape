// Round avatar: shows the user's picture, or their initial on an accent circle.
// Plain presentational component — usable in both server and client components.
export function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Avatar"}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.42) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
