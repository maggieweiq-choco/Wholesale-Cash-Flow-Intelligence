import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export interface InventoryExceptionBucket {
  id: "high_wip_low_sales" | "wip_dominant" | "high_value_wip";
  label: string;
  description: string;
  count: number;
  totalValue: number;
  severity: "high" | "medium";
}

export function buildInventoryExceptionBuckets(items: DeadStockItemWithValue[]): InventoryExceptionBucket[] {
  const highWipLowSales = items.filter((item) => item.wipQty > 0 && item.daysOfSupply >= 120);
  const wipDominant = items.filter((item) => item.totalSupplyQty > 0 && item.wipQty / item.totalSupplyQty >= 0.4);
  const highValueWip = items.filter((item) => item.wipValue >= 1_000);

  return [
    {
      id: "high_wip_low_sales",
      label: "High WIP, Low Sales",
      description: "WIP exists, but current supply already covers a long period.",
      count: highWipLowSales.length,
      totalValue: highWipLowSales.reduce((sum, item) => sum + item.wipValue, 0),
      severity: "high",
    },
    {
      id: "wip_dominant",
      label: "WIP-Dominant Supply",
      description: "A large share of available supply is still not finished.",
      count: wipDominant.length,
      totalValue: wipDominant.reduce((sum, item) => sum + item.wipValue, 0),
      severity: "medium",
    },
    {
      id: "high_value_wip",
      label: "High-Value WIP",
      description: "Material cash is tied up in unfinished goods.",
      count: highValueWip.length,
      totalValue: highValueWip.reduce((sum, item) => sum + item.wipValue, 0),
      severity: "high",
    },
  ];
}

export function inventoryExceptionMatches(bucketId: InventoryExceptionBucket["id"], item: DeadStockItemWithValue): boolean {
  if (bucketId === "high_wip_low_sales") {
    return item.wipQty > 0 && item.daysOfSupply >= 120;
  }
  if (bucketId === "wip_dominant") {
    return item.totalSupplyQty > 0 && item.wipQty / item.totalSupplyQty >= 0.4;
  }
  return item.wipValue >= 1_000;
}

export function InventoryExceptionCards({
  items,
  activeBucketId,
  onSelectBucket,
}: {
  items: DeadStockItemWithValue[];
  activeBucketId?: InventoryExceptionBucket["id"] | null;
  onSelectBucket?: (bucketId: InventoryExceptionBucket["id"] | null) => void;
}) {
  const buckets = buildInventoryExceptionBuckets(items);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {buckets.map((bucket) => (
        <button
          key={bucket.id}
          type="button"
          onClick={() => onSelectBucket?.(activeBucketId === bucket.id ? null : bucket.id)}
          className={`rounded-xl border p-4 shadow-sm ${
            bucket.severity === "high" ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/70"
          } ${activeBucketId === bucket.id ? "ring-2 ring-slate-900" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{bucket.label}</p>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                bucket.severity === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {bucket.severity === "high" ? "High Risk" : "Medium Risk"}
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{bucket.count}</p>
          <p className="mt-1 text-sm text-slate-600">{fmtMoney(bucket.totalValue)} WIP value</p>
          <p className="mt-2 text-xs text-slate-500">{bucket.description}</p>
        </button>
      ))}
    </div>
  );
}
