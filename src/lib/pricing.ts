// Shared marketplace vocabulary: the access-duration tiers a reader can buy,
// and helpers for prices and expiry. Prices are integers in a single mock
// currency unit (0 = free).

export type Tier = "1h" | "1d" | "1w" | "1y" | "always";

export const TIERS: Tier[] = ["1h", "1d", "1w", "1y", "always"];

export const TIER_LABELS: Record<Tier, string> = {
  "1h": "1 hour",
  "1d": "1 day",
  "1w": "1 week",
  "1y": "1 year",
  always: "Always",
};

// Mock currency. Change this one constant (and later wire a real provider) when
// you start charging for real.
export const CURRENCY = "₹";

export function isTier(v: unknown): v is Tier {
  return typeof v === "string" && (TIERS as string[]).includes(v);
}

export function formatPrice(amount: number): string {
  return amount <= 0 ? "Free" : `${CURRENCY}${amount}`;
}

// When does access bought now, for `duration`, expire? null = never.
export function expiryFor(duration: Tier, from: Date = new Date()): Date | null {
  const ms: Record<Exclude<Tier, "always">, number> = {
    "1h": 3_600_000,
    "1d": 86_400_000,
    "1w": 604_800_000,
    "1y": 31_536_000_000,
  };
  if (duration === "always") return null;
  return new Date(from.getTime() + ms[duration]);
}

// Cleans an untrusted {tier: price} object into a map of offered tiers with
// non-negative integer prices. Only keeps the given offered tiers.
export function normalizePrices(
  input: unknown,
  offered: Tier[],
): Partial<Record<Tier, number>> {
  const out: Partial<Record<Tier, number>> = {};
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;
  for (const tier of offered) {
    const raw = obj[tier];
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      out[tier] = Math.floor(n);
    }
  }
  return out;
}

export function normalizeOfferedDurations(input: unknown): Tier[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<Tier>();
  for (const v of input) if (isTier(v)) seen.add(v);
  // Keep canonical order.
  return TIERS.filter((t) => seen.has(t));
}
