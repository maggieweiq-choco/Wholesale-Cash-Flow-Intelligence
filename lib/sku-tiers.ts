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
  customerId?: string | null;
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

// A SKU's product type reflects how customers actually buy it: "Stock" if
// most sales are a customer's first purchase of that SKU (new-customer
// acquisition item); "Reorder" if most sales are repeat purchases by a
// customer who has bought that SKU before (recurring restock demand).
// Sales rows without a customerId can't be classified and are ignored —
// a SKU with no attributable sales defaults to "Stock".
export function productTypeBySku(skus: string[], sales: SalesRow[]): Map<string, "Stock" | "Reorder"> {
  const attributed = sales.filter((s) => s.customerId);

  // First purchase date per (customerId, sku) pair.
  const firstPurchase = new Map<string, number>();
  for (const s of attributed) {
    const key = `${s.customerId}::${s.sku}`;
    const t = new Date(s.soldAt).getTime();
    const prev = firstPurchase.get(key);
    if (prev === undefined || t < prev) firstPurchase.set(key, t);
  }

  const counts = new Map<string, { first: number; repeat: number }>();
  for (const s of attributed) {
    const key = `${s.customerId}::${s.sku}`;
    const t = new Date(s.soldAt).getTime();
    const isFirst = t === firstPurchase.get(key);
    const entry = counts.get(s.sku) ?? { first: 0, repeat: 0 };
    if (isFirst) entry.first += 1;
    else entry.repeat += 1;
    counts.set(s.sku, entry);
  }

  const result = new Map<string, "Stock" | "Reorder">();
  for (const sku of skus) {
    const entry = counts.get(sku);
    result.set(sku, entry && entry.repeat > entry.first ? "Reorder" : "Stock");
  }
  return result;
}
