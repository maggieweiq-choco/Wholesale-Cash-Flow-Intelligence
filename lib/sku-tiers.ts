// Shared SKU tiering used by dead-stock discounts and purchasing/reorder
// logic. The tier is deterministic and auditable: AI may explain it later,
// but it does not decide the A/B/C/D classification.
//
// Tier score components:
//   + sales velocity
//   + margin quality
//   - excess days of supply
//   - cash tied up
//   - obsolete/return risk
//   + stockout risk adjustment
//   - vendor lead time risk

export type SkuTier = "A" | "B" | "C" | "D";

export const TIER_DISCOUNT_PCT: Record<SkuTier, number> = { A: 0, B: 15, C: 30, D: 45 };

export const TIER_LABEL: Record<SkuTier, string> = {
  A: "A — Strong performers",
  B: "B — Healthy",
  C: "C — Watchlist",
  D: "D — High-risk slow movers",
};

const SALES_WINDOW_DAYS = 180;
const TARGET_DAYS_OF_SUPPLY = 30;

interface SalesRow {
  sku: string;
  soldQty: number;
  soldAt: string;
  revenue?: string | null;
}

interface InventoryTierRow {
  sku: string;
  qtyOnHand: number;
  unitCost?: string | null;
  vendorLeadTimeDays?: number | null;
  returnRatePct?: string | null;
  obsoleteRisk?: string | null;
}

interface SkuMetrics {
  sku: string;
  totalSold: number;
  avgDailyVelocity: number;
  daysOfSupply: number;
  inventoryValue: number;
  grossMarginPct: number | null;
  vendorLeadTimeDays: number;
  returnRatePct: number;
  obsoleteRisk: string;
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

function tierForRank(rankPct: number): SkuTier {
  if (rankPct < 30) return "A";
  if (rankPct < 60) return "B";
  if (rankPct < 90) return "C";
  return "D";
}

function normalizeByMax(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp(value / max);
}

function obsoleteRiskPenalty(risk: string): number {
  const normalized = risk.toLowerCase();
  if (normalized === "high") return 1;
  if (normalized === "medium") return 0.55;
  return 0;
}

function buildMetrics(inventoryRows: InventoryTierRow[], sales: SalesRow[]): SkuMetrics[] {
  const cutoff = Date.now() - SALES_WINDOW_DAYS * 86_400_000;
  const bySku = new Map<string, { totalQty: number; revenue: number; minDate: number; maxDate: number }>();

  for (const sale of sales) {
    const soldAt = new Date(sale.soldAt).getTime();
    if (soldAt < cutoff) continue;
    const entry = bySku.get(sale.sku) ?? { totalQty: 0, revenue: 0, minDate: soldAt, maxDate: soldAt };
    entry.totalQty += sale.soldQty;
    entry.revenue += Number(sale.revenue ?? 0);
    entry.minDate = Math.min(entry.minDate, soldAt);
    entry.maxDate = Math.max(entry.maxDate, soldAt);
    bySku.set(sale.sku, entry);
  }

  return inventoryRows.map((row) => {
    const salesSummary = bySku.get(row.sku);
    const spanDays = salesSummary ? Math.max(1, Math.round((salesSummary.maxDate - salesSummary.minDate) / 86_400_000) + 1) : 0;
    const avgDailyVelocity = salesSummary && spanDays > 0 ? salesSummary.totalQty / spanDays : 0;
    const daysOfSupply = avgDailyVelocity > 0 ? Math.round(row.qtyOnHand / avgDailyVelocity) : 999;
    const unitCost = Number(row.unitCost ?? 0);
    const inventoryValue = row.qtyOnHand * unitCost;
    const cogs = (salesSummary?.totalQty ?? 0) * unitCost;
    const revenue = salesSummary?.revenue ?? 0;
    const grossMarginPct = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : null;

    return {
      sku: row.sku,
      totalSold: salesSummary?.totalQty ?? 0,
      avgDailyVelocity,
      daysOfSupply,
      inventoryValue,
      grossMarginPct,
      vendorLeadTimeDays: row.vendorLeadTimeDays ?? 14,
      returnRatePct: Number(row.returnRatePct ?? 0),
      obsoleteRisk: row.obsoleteRisk ?? "low",
    };
  });
}

function scoreSku(metric: SkuMetrics, maxSold: number, maxInventoryValue: number): number {
  const salesVelocity = normalizeByMax(metric.totalSold, maxSold);
  const marginQuality = metric.grossMarginPct == null ? 0.45 : clamp(metric.grossMarginPct / 60);
  const excessDays = clamp((metric.daysOfSupply - TARGET_DAYS_OF_SUPPLY) / 180);
  const cashTiedUp = normalizeByMax(metric.inventoryValue, maxInventoryValue);
  const returnRisk = clamp(metric.returnRatePct / 20);
  const obsoleteRisk = obsoleteRiskPenalty(metric.obsoleteRisk);
  const stockoutRisk = clamp((TARGET_DAYS_OF_SUPPLY - metric.daysOfSupply) / TARGET_DAYS_OF_SUPPLY);
  const leadTimeRisk = clamp((metric.vendorLeadTimeDays - 14) / 45);

  return (
    salesVelocity * 45 +
    marginQuality * 18 -
    excessDays * 18 -
    cashTiedUp * 12 -
    returnRisk * 8 -
    obsoleteRisk * 12 +
    stockoutRisk * 14 -
    leadTimeRisk * 7
  );
}

export function tierSkusByCompositeScore(inventoryRows: InventoryTierRow[], sales: SalesRow[]): Map<string, SkuTier> {
  const metrics = buildMetrics(inventoryRows, sales);
  const maxSold = Math.max(0, ...metrics.map((metric) => metric.totalSold));
  const maxInventoryValue = Math.max(0, ...metrics.map((metric) => metric.inventoryValue));
  const ranked = metrics
    .map((metric) => ({ sku: metric.sku, score: scoreSku(metric, maxSold, maxInventoryValue) }))
    .sort((a, b) => b.score - a.score);

  const tiers = new Map<string, SkuTier>();
  ranked.forEach((item, index) => {
    const rankPct = (index / Math.max(1, ranked.length)) * 100;
    tiers.set(item.sku, tierForRank(rankPct));
  });
  return tiers;
}

// Backward-compatible name used by existing inventory/purchasing modules.
// If only SKU strings are passed, fall back to pure sales-velocity ranking.
export function tierSkusBySalesVelocity(skusOrInventory: string[] | InventoryTierRow[], sales: SalesRow[]): Map<string, SkuTier> {
  if (typeof skusOrInventory[0] === "string") {
    const inventoryRows = (skusOrInventory as string[]).map((sku) => ({ sku, qtyOnHand: 0 }));
    return tierSkusByCompositeScore(inventoryRows, sales);
  }

  return tierSkusByCompositeScore(skusOrInventory as InventoryTierRow[], sales);
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
