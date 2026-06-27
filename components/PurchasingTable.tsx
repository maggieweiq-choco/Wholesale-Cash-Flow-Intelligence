import type { PurchasingItem } from "@/agents/purchasing-agent";

export function PurchasingTable({ items }: { items: PurchasingItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Nothing needs reordering right now.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">SKU</th>
          <th className="py-2 pr-4">Vendor</th>
          <th className="py-2 pr-4">Days of Supply</th>
          <th className="py-2 pr-4">Recommended Qty</th>
          <th className="py-2 pr-4">Est. Cost</th>
          <th className="py-2">Urgency</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 font-medium text-slate-900">{item.sku}</td>
            <td className="py-3 pr-4 text-slate-600">{item.vendorName ?? "—"}</td>
            <td className="py-3 pr-4 text-slate-600">{item.daysOfSupply}</td>
            <td className="py-3 pr-4 text-slate-600">{item.recommendedQty.toLocaleString()}</td>
            <td className="py-3 pr-4 text-slate-600">${item.estimatedCost.toLocaleString()}</td>
            <td className="py-3">
              <UrgencyBadge urgency={item.urgency} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UrgencyBadge({ urgency }: { urgency: PurchasingItem["urgency"] }) {
  const tone =
    urgency === "reorder_now"
      ? "bg-red-50 text-red-700"
      : urgency === "reorder_soon"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-700";
  const label = urgency === "reorder_now" ? "Reorder now" : urgency === "reorder_soon" ? "Reorder soon" : "Healthy";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}
