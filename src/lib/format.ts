// Compact, human-friendly counts: 999 -> "999", 12400 -> "12.4k", 3_200_000 -> "3.2M".
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.floor(n || 0)));
  if (n < 1_000_000) {
    const v = n / 1000;
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "k";
  }
  const v = n / 1_000_000;
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "M";
}
