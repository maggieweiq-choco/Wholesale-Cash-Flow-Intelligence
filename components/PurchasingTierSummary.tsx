import type { PurchasingItem } from "@/agents/purchasing-agent";
import type { SkuTier } from "@/lib/sku-tiers";

const TIERS: SkuTier[] = ["A", "B", "C", "D"];

const TIER_TONE: Record<SkuTier, string> = {
  A: "border-emerald-200 bg-emerald-50/60",
  B: "border-slate-200 bg-white",
  C: "border-amber-200 bg-amber-50/60",
  D: "border-red-200 bg-red-50/60",
};

// Answers "how much cash does reordering this tier take" at a glance: per
// sales-velocity tier, how many SKUs need reordering, the total estimated
// cost, and how many are urgent.
export function PurchasingTierSummary({ items }: { items: PurchasingItem[] }) {
  const byTier = new Map<SkuTier, { count: number; cost: number; urgent: number }>();
  for (const item of items) {
    const entry = byTier.get(item.tier) ?? { count: 0, cost: 0, urgent: 0 };
    entry.count += 1;
    entry.cost += item.estimatedCost;
    if (item.urgency === "reorder_now") entry.urgent += 1;
    byTier.set(item.tier, entry);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {TIERS.map((tier) => {
        const stat = byTier.get(tier) ?? { count: 0, cost: 0, urgent: 0 };
        return (
          <div key={tier} className={`rounded-xl border p-4 ${TIER_TONE[tier]}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tier {tier}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{stat.count} SKUs</p>
            <p className="mt-1 text-sm text-slate-600">${stat.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} to reorder</p>
            <p className="mt-1 text-sm text-slate-600">{stat.urgent} urgent</p>
          </div>
        );
      })}
    </div>
  );
}
