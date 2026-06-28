"use client";

import { useState } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import type { CollectionsItem } from "@/agents/receivables-agent";
import {
  COLLECTION_DETAILS_BASE_PATH,
  COLLECTION_PRIORITY_META,
  COLLECTION_PRIORITY_ORDER,
  type CollectionPriorityTier,
  getCollectionPriorityTier,
  getCollectionTierDetailsHref,
  groupCollectionsByPriority,
} from "@/lib/collections-priority";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPercent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

const PIE_COLORS = {
  critical: "#ef4444",
  high: "#f59e0b",
  monitor: "#0ea5e9",
  low: "#94a3b8",
} as const;

export function ReceivablesPriorityBoard({ items }: { items: CollectionsItem[] }) {
  const [activeTier, setActiveTier] = useState<CollectionPriorityTier | null>(null);

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No overdue invoices.</p>;
  }

  const grouped = groupCollectionsByPriority(items);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const topTier = grouped.find((group) => group.count > 0)?.tier ?? "low";
  const topTierMeta = COLLECTION_PRIORITY_META[topTier];
  const topCount = grouped
    .filter((group) => COLLECTION_PRIORITY_ORDER.indexOf(group.tier) <= COLLECTION_PRIORITY_ORDER.indexOf(topTier))
    .reduce((sum, group) => sum + group.count, 0);
  const chartData = grouped.map((group) => ({
    ...group,
    name: COLLECTION_PRIORITY_META[group.tier].label,
    percent: totalAmount === 0 ? 0 : group.totalAmount / totalAmount,
    fill: PIE_COLORS[group.tier],
  }));
  const activeIndex = activeTier ? chartData.findIndex((entry) => entry.tier === activeTier) : -1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${topTierMeta.badgeClassName}`}>
              {topTierMeta.label}
            </span>
            <p className="text-sm text-slate-600">
              Focus collections on the highest-value overdue invoices first, then work down the queue.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Overdue invoices" value={String(items.length)} />
            <MetricCard label="Open overdue value" value={fmtMoney(totalAmount)} />
            <MetricCard label="Top queue items" value={String(topCount)} />
          </div>
        </div>

        <Link href={COLLECTION_DETAILS_BASE_PATH} className="text-sm font-medium text-slate-900 underline underline-offset-2">
          View full list & export ({items.length} invoices) →
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-900">Priority distribution</p>
          <p className="text-xs text-slate-400">By overdue invoice value</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                  activeShape={ActivePieSlice}
                  dataKey="totalAmount"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={3}
                  labelLine={false}
                  label={({ percent }) => (percent && percent > 0 ? `${Math.round(percent * 100)}%` : "")}
                  onMouseEnter={(_, index) => {
                    const hovered = chartData[index];
                    setActiveTier(hovered?.tier ?? null);
                  }}
                  onMouseLeave={() => setActiveTier(null)}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.tier} fill={entry.fill} />
                  ))}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className="fill-slate-400 text-[11px] font-medium">
                  Total overdue
                </text>
                <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 text-[16px] font-semibold">
                  {fmtMoney(totalAmount)}
                </text>
                <Tooltip
                  formatter={(value: number, _name, item) => {
                    const payload = item.payload as (typeof chartData)[number];
                    return [`${fmtMoney(value)} · ${payload.count} invoices`, payload.name];
                  }}
                  contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {grouped.map((group) => {
              const meta = COLLECTION_PRIORITY_META[group.tier];
              const isActive = activeTier === group.tier;
              return (
                <div key={group.tier} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <Link
                    href={getCollectionTierDetailsHref(group.tier)}
                    className={`block rounded-md transition ${isActive ? "bg-white shadow-sm" : ""}`}
                    onMouseEnter={() => setActiveTier(group.tier)}
                    onMouseLeave={() => setActiveTier(null)}
                  >
                  <div className="flex items-center gap-2 px-2 pt-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[group.tier] }}
                    />
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{meta.label}</p>
                  </div>
                  <p className="mt-2 px-2 text-sm font-semibold text-slate-900">{fmtMoney(group.totalAmount)}</p>
                  <p className="px-2 pb-2 text-xs text-slate-500">
                    {fmtPercent(group.totalAmount, totalAmount)} of value · {group.count} invoices
                  </p>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {grouped.map((group) => {
          const meta = COLLECTION_PRIORITY_META[group.tier];
          return (
            <Link
              key={group.tier}
              href={getCollectionTierDetailsHref(group.tier)}
              className={`block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${meta.panelClassName}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{meta.description}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${meta.badgeClassName}`}>
                  {group.count}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-900">{fmtMoney(group.totalAmount)}</p>
              <p className="mt-1 text-xs text-slate-600">{fmtPercent(group.totalAmount, totalAmount)} of overdue invoice value</p>

              <div className="mt-3 space-y-2">
                {group.items.slice(0, 3).map((item) => (
                  <div key={item.invoiceId} className="rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">INV-{item.invoiceId}</p>
                      <p className="text-sm font-semibold text-slate-900">{fmtMoney(item.amount)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-600">
                      <span>{item.customerId}</span>
                      <span>{item.daysOverdue}d overdue</span>
                    </div>
                  </div>
                ))}

                {group.items.length === 0 && <p className="rounded-lg bg-white/80 px-3 py-4 text-xs text-slate-500">No invoices in this band.</p>}
                {group.items.length > 3 && (
                  <p className="text-xs font-medium text-slate-600 underline underline-offset-2">
                    +{group.items.length - 3} more in this priority band
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ActivePieSlice(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill = "#000000" } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function CollectionPriorityBadge({ item }: { item: CollectionsItem }) {
  const tier = getCollectionPriorityTier(item);
  const meta = COLLECTION_PRIORITY_META[tier];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClassName}`}>{meta.shortLabel}</span>;
}
