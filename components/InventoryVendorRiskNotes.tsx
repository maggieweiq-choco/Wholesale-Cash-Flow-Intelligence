import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function InventoryVendorRiskNotes({ items }: { items: DeadStockItemWithValue[] }) {
  const groups = groupByVendor(items);
  if (groups.length === 0) return null;

  const highestWipValue = [...groups].sort((a, b) => b.wipValue - a.wipValue)[0];
  const highestWipShare = [...groups].sort((a, b) => b.wipShare - a.wipShare)[0];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Highest WIP Value Vendor</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">{highestWipValue.vendor}</p>
        <p className="mt-1 text-sm text-slate-600">{fmtMoney(highestWipValue.wipValue)} tied up in WIP</p>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-red-700">Highest WIP Share Vendor</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">{highestWipShare.vendor}</p>
        <p className="mt-1 text-sm text-slate-600">{Math.round(highestWipShare.wipShare * 100)}% of supply still unfinished</p>
      </div>
    </div>
  );
}

function groupByVendor(items: DeadStockItemWithValue[]) {
  const byVendor = new Map<
    string,
    { vendor: string; onHandValue: number; wipValue: number; totalSupplyValue: number; wipShare: number }
  >();

  for (const item of items) {
    const vendor = item.vendorName?.trim() || "Unknown Vendor";
    const current = byVendor.get(vendor) ?? { vendor, onHandValue: 0, wipValue: 0, totalSupplyValue: 0, wipShare: 0 };
    current.onHandValue += item.inventoryValue;
    current.wipValue += item.wipValue;
    current.totalSupplyValue += item.inventoryValue + item.wipValue;
    byVendor.set(vendor, current);
  }

  return [...byVendor.values()].map((entry) => ({
    ...entry,
    wipShare: entry.totalSupplyValue > 0 ? entry.wipValue / entry.totalSupplyValue : 0,
  }));
}
