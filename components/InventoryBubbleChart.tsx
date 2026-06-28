"use client";

import {
  CartesianGrid,
  ReferenceArea,
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

const QUADRANTS = [
  { label: "High Value · High Days → Reposition / Liquidate", dot: "bg-red-500" },
  { label: "High Value · Low Days → Maintain Pace", dot: "bg-emerald-500" },
  { label: "Low Value · High Days → Targeted Marketing", dot: "bg-amber-500" },
  { label: "Low Value · Low Days → No Action Needed", dot: "bg-slate-400" },
];

export function InventoryBubbleChart({ items }: { items: DeadStockItemWithValue[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No inventory to plot.</p>;
  }

  const medianDays = median(items.map((i) => i.daysOfSupply));
  const medianValue = median(items.map((i) => i.inventoryValue));
  const maxDays = Math.max(...items.map((i) => i.daysOfSupply));
  const maxValue = Math.max(...items.map((i) => i.inventoryValue));

  return (
    <div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          {/* Quadrant shading: red=liquidate, green=healthy, amber=marketing, slate=no action */}
          <ReferenceArea x1={medianDays} x2={maxDays} y1={medianValue} y2={maxValue} fill="#ef4444" fillOpacity={0.08} />
          <ReferenceArea x1={0} x2={medianDays} y1={medianValue} y2={maxValue} fill="#10b981" fillOpacity={0.08} />
          <ReferenceArea x1={medianDays} x2={maxDays} y1={0} y2={medianValue} fill="#f59e0b" fillOpacity={0.08} />
          <ReferenceArea x1={0} x2={medianDays} y1={0} y2={medianValue} fill="#94a3b8" fillOpacity={0.08} />

          <XAxis
            type="number"
            dataKey="daysOfSupply"
            name="Days of Supply"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
            label={{ value: "Days of Supply", position: "insideBottom", offset: -4, fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            type="number"
            dataKey="inventoryValue"
            name="Inventory Value"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            label={{ value: "Inventory Value", angle: -90, position: "insideLeft", fontSize: 12, fill: "#64748b" }}
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
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
        {QUADRANTS.map((q) => (
          <span key={q.label} className="flex items-center justify-center gap-1.5 text-center">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${q.dot}`} />
            {q.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
