import type { DeadStockItem } from "@/agents/inventory-agent";

export function DeadStockTable({ items }: { items: DeadStockItem[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-zinc-500">
          <th className="py-2">SKU</th>
          <th className="py-2">Days of Supply</th>
          <th className="py-2">Suggested Discount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku} className="border-t border-zinc-200">
            <td className="py-2">{item.sku}</td>
            <td className="py-2">{item.daysOfSupply}</td>
            <td className="py-2">{item.suggestedDiscountPct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
