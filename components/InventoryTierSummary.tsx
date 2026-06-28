import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { TIER_DISCOUNT_PCT, type SkuTier } from "@/lib/sku-tiers";

const TIERS: SkuTier[] = ["A", "B", "C", "D"];

const TIER_TONE: Record<SkuTier, string> = {
  A: "border-emerald-200 bg-emerald-50/60",
  B: "border-slate-200 bg-white",
  C: "border-amber-200 bg-amber-50/60",
  D: "border-red-200 bg-red-50/60",
};

// Answers "how much markdown $ does it take to keep cash moving" at a
// glance: per composite tier, how many SKUs, how much inventory value, and
// applying that tier's fixed discount, how much markdown that implies.
export function InventoryTierSummary({ items }: { items: DeadStockItemWithValue[] }) {
  const byTier = new Map<SkuTier, { count: number; value: number }>();
  for (const item of items) {
    const entry = byTier.get(item.tier) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += item.inventoryValue;
    byTier.set(item.tier, entry);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {TIERS.map((tier) => {
        const stat = byTier.get(tier) ?? { count: 0, value: 0 };
        const discountPct = TIER_DISCOUNT_PCT[tier];
        const markdown = stat.value * (discountPct / 100);
        return (
          <div key={tier} className={`rounded-xl border p-4 ${TIER_TONE[tier]}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tier {tier}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{stat.count} SKUs</p>
            <p className="mt-1 text-sm text-slate-600">${stat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} value</p>
            <p className="mt-1 text-sm text-slate-600">
              {discountPct}% off → ${markdown.toLocaleString(undefined, { maximumFractionDigits: 0 })} markdown
            </p>
          </div>
        );
      })}
    </div>
  );
}
