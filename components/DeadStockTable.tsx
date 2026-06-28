import type { DeadStockItem } from "@/agents/inventory-agent";

export function DeadStockTable({ items }: { items: DeadStockItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No dead stock found.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">SKU</th>
          <th className="py-2 pr-4">Tier</th>
          <th className="py-2 pr-4">Type</th>
          <th className="py-2 pr-4">Days of Supply</th>
          <th className="py-2 pr-4">Suggested Discount</th>
          <th className="py-2">Recommendations</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 font-medium text-slate-900">{item.sku}</td>
            <td className="py-3 pr-4">
              <TierBadge tier={item.tier} />
            </td>
            <td className="py-3 pr-4 text-slate-600">{item.productType}</td>
            <td className="py-3 pr-4 text-slate-600">{item.daysOfSupply}</td>
            <td className="py-3 pr-4">
              <DiscountBadge pct={item.suggestedDiscountPct} />
            </td>
            <td className="py-3 max-w-xs">
              <p className="text-slate-700">{item.reorderRecommendation}</p>
              <p className="mt-1 text-xs text-slate-400">{item.vendorNegotiationTip}</p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TierBadge({ tier }: { tier: "A" | "B" | "C" | "D" }) {
  const tone =
    tier === "A"
      ? "bg-emerald-50 text-emerald-700"
      : tier === "B"
      ? "bg-slate-100 text-slate-700"
      : tier === "C"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{tier}</span>;
}

function DiscountBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 40
      ? "bg-red-50 text-red-700"
      : pct >= 20
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{pct}%</span>
  );
}
