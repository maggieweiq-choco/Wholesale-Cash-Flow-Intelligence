// Shared sales-velocity tiering used by both the dead-stock discount logic
// and the purchasing/reorder logic, so a SKU's "best seller" vs "slow mover"
// classification is consistent everywhere it shows up.
//
// Tiers are percentile bands over total units sold in the last 180 days,
// ranked best-seller first:
//   A  0-30%   best sellers   — no discount, reorder aggressively
//   B  30-60%                 — light discount, normal reorder cadence
//   C  60-90%                 — deeper discount, reorder only if running low
//   D  90-100% worst sellers  — heaviest discount, do not reorder

export type SkuTier = "A" | "B" | "C" | "D";

export const TIER_DISCOUNT_PCT: Record<SkuTier, number> = { A: 0, B: 15, C: 30, D: 45 };

export const TIER_LABEL: Record<SkuTier, string> = {
  A: "A — Top 30% (best sellers)",
  B: "B — 30-60%",
  C: "C — 60-90%",
  D: "D — Bottom 10% (slowest movers)",
};

const SALES_WINDOW_DAYS = 180;

interface SalesRow {
  sku: string;
  soldQty: number;
  soldAt: string;
}

function tierForPercentile(rankPct: number): SkuTier {
  if (rankPct < 30) return "A";
  if (rankPct < 60) return "B";
  if (rankPct < 90) return "C";
  return "D";
}

// Ranks every SKU present in `skus` by total units sold in the last
// SALES_WINDOW_DAYS, best seller first, and returns a tier per SKU. SKUs
// with no sales in the window land in the worst tier (D) — no velocity
// data means nothing is moving.
export function tierSkusBySalesVelocity(skus: string[], sales: SalesRow[]): Map<string, SkuTier> {
  const cutoff = Date.now() - SALES_WINDOW_DAYS * 86_400_000;
  const totalsBySku = new Map<string, number>();
  for (const s of sales) {
    if (new Date(s.soldAt).getTime() < cutoff) continue;
    totalsBySku.set(s.sku, (totalsBySku.get(s.sku) ?? 0) + s.soldQty);
  }

  const ranked = [...skus].sort((a, b) => (totalsBySku.get(b) ?? 0) - (totalsBySku.get(a) ?? 0));

  const tiers = new Map<string, SkuTier>();
  ranked.forEach((sku, i) => {
    const rankPct = (i / Math.max(1, ranked.length)) * 100;
    tiers.set(sku, tierForPercentile(rankPct));
  });
  return tiers;
}

// Inventory is a current-state snapshot, so a SKU should appear once.
// lib/etl.ts prevents new duplicates on re-upload, but this guards against
// any stale duplicate rows already in Aurora from before that fix — keeps
// the most recently inserted row per SKU (highest id).
export function dedupeBySku<T extends { sku: string; id?: number }>(rows: T[]): T[] {
  const bySku = new Map<string, T>();
  for (const row of rows) {
    const prev = bySku.get(row.sku);
    if (!prev || (row.id ?? 0) >= (prev.id ?? 0)) bySku.set(row.sku, row);
  }
  return [...bySku.values()];
}
