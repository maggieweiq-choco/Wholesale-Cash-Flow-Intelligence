"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import type { SkuTier } from "@/lib/sku-tiers";

const TIERS: SkuTier[] = ["A", "B", "C", "D"];
const MAX_VENDOR_BARS = 6;

export function InventorySupplyChart({
  items,
  dimension = "tier",
}: {
  items: DeadStockItemWithValue[];
  dimension?: "tier" | "vendor";
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No inventory supply data to chart.</p>;
  }

  const data =
    dimension === "tier"
      ? TIERS.map((tier) => {
          const tierItems = items.filter((item) => item.tier === tier);
          const onHandValue = tierItems.reduce((sum, item) => sum + item.inventoryValue, 0);
          const wipValue = tierItems.reduce((sum, item) => sum + item.wipValue, 0);
          return {
            label: `Tier ${tier}`,
            onHandValue,
            wipValue,
            total: onHandValue + wipValue,
          };
        })
      : [...groupByVendor(items)].slice(0, MAX_VENDOR_BARS).map(([vendor, vendorItems]) => {
          const onHandValue = vendorItems.reduce((sum, item) => sum + item.inventoryValue, 0);
          const wipValue = vendorItems.reduce((sum, item) => sum + item.wipValue, 0);
          return {
            label: vendor,
            onHandValue,
            wipValue,
            total: onHandValue + wipValue,
          };
        });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
          interval={0}
          angle={dimension === "vendor" ? -18 : 0}
          textAnchor={dimension === "vendor" ? "end" : "middle"}
          height={dimension === "vendor" ? 56 : 30}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name === "onHandValue" ? "On Hand" : "WIP"]}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === "onHandValue" ? "On Hand" : "WIP")} />
        <Bar dataKey="onHandValue" stackId="supply" fill="#0f172a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="wipValue" stackId="supply" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function groupByVendor(items: DeadStockItemWithValue[]) {
  const byVendor = new Map<string, DeadStockItemWithValue[]>();
  for (const item of items) {
    const key = item.vendorName?.trim() || "Unknown Vendor";
    const entry = byVendor.get(key) ?? [];
    entry.push(item);
    byVendor.set(key, entry);
  }

  return [...byVendor.entries()].sort((a, b) => {
    const totalA = a[1].reduce((sum, item) => sum + item.inventoryValue + item.wipValue, 0);
    const totalB = b[1].reduce((sum, item) => sum + item.inventoryValue + item.wipValue, 0);
    return totalB - totalA;
  });
}
