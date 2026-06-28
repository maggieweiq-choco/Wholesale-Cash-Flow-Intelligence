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

export type DeadStockItemWithValue = DeadStockItem & {
  inventoryValue: number;
  wipQty: number;
  wipValue: number;
  totalSupplyQty: number;
  vendorName?: string | null;
  vendorCountry?: string | null;
  grossMarginPct?: number | null;
  vendorLeadTimeDays?: number;
  returnRatePct?: number;
  obsoleteRisk?: string;
};

const QUADRANTS = [
  { id: "liquidate", label: "High value · high days", action: "Reposition / Liquidate", color: "#ef4444", dot: "bg-red-500" },
  { id: "maintain", label: "High value · low days", action: "Maintain pace", color: "#10b981", dot: "bg-emerald-500" },
  { id: "marketing", label: "Low value · high days", action: "Targeted marketing", color: "#f59e0b", dot: "bg-amber-500" },
  { id: "routine", label: "Low value · low days", action: "No action needed", color: "#64748b", dot: "bg-slate-500" },
];

export function InventoryBubbleChart({ items }: { items: DeadStockItemWithValue[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No inventory to plot.</p>;
  }

  const medianDays = median(items.map((i) => i.daysOfSupply));
  const medianValue = median(items.map((i) => i.inventoryValue));
  const maxDays = Math.max(...items.map((i) => i.daysOfSupply));
  const maxValue = Math.max(...items.map((i) => i.inventoryValue));
  const plottedItems = QUADRANTS.map((quadrant) => ({
    ...quadrant,
    items: items.filter((item) => getQuadrantId(item, medianDays, medianValue) === quadrant.id),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 18, right: 24, bottom: 12, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          {/* Quadrant shading: red=liquidate, green=healthy, amber=marketing, slate=no action */}
          <ReferenceArea x1={medianDays} x2={maxDays} y1={medianValue} y2={maxValue} fill="#ef4444" fillOpacity={0.045} />
          <ReferenceArea x1={0} x2={medianDays} y1={medianValue} y2={maxValue} fill="#10b981" fillOpacity={0.045} />
          <ReferenceArea x1={medianDays} x2={maxDays} y1={0} y2={medianValue} fill="#f59e0b" fillOpacity={0.045} />
          <ReferenceArea x1={0} x2={medianDays} y1={0} y2={medianValue} fill="#94a3b8" fillOpacity={0.045} />

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
          <ZAxis dataKey="suggestedDiscountPct" range={[36, 220]} name="Suggested Discount" />
          <ReferenceLine
            x={medianDays}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: "Median days", fill: "#64748b", fontSize: 11, position: "insideTop" }}
          />
          <ReferenceLine
            y={medianValue}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: "Median value", fill: "#64748b", fontSize: 11, position: "insideLeft" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const item = payload[0].payload as DeadStockItemWithValue;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold text-slate-900">{item.sku}</p>
                  <p className="text-slate-500">Action zone: {QUADRANTS.find((q) => q.id === getQuadrantId(item, medianDays, medianValue))?.action}</p>
                  <p className="text-slate-500">Days of supply: {item.daysOfSupply}</p>
                  <p className="text-slate-500">On-hand value: ${item.inventoryValue.toLocaleString()}</p>
                  <p className="text-slate-500">WIP: {item.wipQty} units · ${item.wipValue.toLocaleString()}</p>
                  <p className="text-slate-500">Discount: {item.suggestedDiscountPct}%</p>
                </div>
              );
            }}
          />
          {plottedItems.map((quadrant) => (
            <Scatter
              key={quadrant.id}
              data={quadrant.items}
              fill={quadrant.color}
              fillOpacity={0.42}
              stroke="#ffffff"
              strokeOpacity={0.7}
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
        {QUADRANTS.map((q) => (
          <span key={q.id} className="flex items-start justify-center gap-1.5 text-center">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${q.dot}`} />
            <span>
              <span className="block font-medium text-slate-600">{q.label}</span>
              <span className="block">{q.action}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function getQuadrantId(item: DeadStockItemWithValue, medianDays: number, medianValue: number): (typeof QUADRANTS)[number]["id"] {
  if (item.inventoryValue >= medianValue && item.daysOfSupply >= medianDays) return "liquidate";
  if (item.inventoryValue >= medianValue && item.daysOfSupply < medianDays) return "maintain";
  if (item.inventoryValue < medianValue && item.daysOfSupply >= medianDays) return "marketing";
  return "routine";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
