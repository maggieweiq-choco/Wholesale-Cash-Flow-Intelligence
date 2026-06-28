"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DeadStockItem } from "@/agents/inventory-agent";
import { TIER_DISCOUNT_PCT, type SkuTier } from "@/lib/sku-tiers";

const TIERS: SkuTier[] = ["A", "B", "C", "D"];
const TIER_COLOR: Record<SkuTier, string> = { A: "#10b981", B: "#94a3b8", C: "#f59e0b", D: "#ef4444" };

// At-a-glance answer to "how many SKUs sit at each discount level" — one
// bar per tier, sized by SKU count, labeled with that tier's fixed discount.
export function DiscountDistributionChart({ items }: { items: DeadStockItem[] }) {
  const data = TIERS.map((tier) => ({
    tier,
    label: `${tier} (${TIER_DISCOUNT_PCT[tier]}% off)`,
    count: items.filter((item) => item.tier === tier).length,
  }));

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data to chart.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value: number) => [`${value} SKUs`, "Count"]}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.tier} fill={TIER_COLOR[d.tier]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
