"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { DeadStockItem } from "@/agents/inventory-agent";

export type DeadStockItemWithValue = DeadStockItem & { inventoryValue: number };

export function InventoryBubbleChart({ items }: { items: DeadStockItemWithValue[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No inventory to plot.</p>;
  }

  const medianDays = median(items.map((i) => i.daysOfSupply));
  const medianValue = median(items.map((i) => i.inventoryValue));

  return (
    <div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="daysOfSupply"
            name="Days of Supply"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
            label={{ value: "Days of Supply (库龄)", position: "insideBottom", offset: -4, fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            type="number"
            dataKey="inventoryValue"
            name="Inventory Value"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            label={{ value: "Inventory Value (金额)", angle: -90, position: "insideLeft", fontSize: 12, fill: "#64748b" }}
          />
          <ZAxis dataKey="suggestedDiscountPct" range={[80, 500]} name="Suggested Discount" />
          <ReferenceLine x={medianDays} stroke="#cbd5e1" strokeDasharray="4 4" />
          <ReferenceLine y={medianValue} stroke="#cbd5e1" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const item = payload[0].payload as DeadStockItemWithValue;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold text-slate-900">{item.sku}</p>
                  <p className="text-slate-500">Days of supply: {item.daysOfSupply}</p>
                  <p className="text-slate-500">Value: ${item.inventoryValue.toLocaleString()}</p>
                  <p className="text-slate-500">Discount: {item.suggestedDiscountPct}%</p>
                </div>
              );
            }}
          />
          <Scatter data={items} fill="#0f172a" fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs text-slate-400 sm:grid-cols-4">
        <span>高金额 · 高库龄 → 重新定位/清仓</span>
        <span>高金额 · 低库龄 → 维持节奏</span>
        <span>低金额 · 高库龄 → 精准营销</span>
        <span>低金额 · 低库龄 → 无需干预</span>
      </div>
    </div>
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
