"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReceivablesTable } from "@/components/ReceivablesTable";
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
import { downloadCsv } from "@/lib/csv-export";

const TIER_OPTIONS: (CollectionPriorityTier | "all")[] = ["all", ...COLLECTION_PRIORITY_ORDER];

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function percentageLabel(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export function ReceivablesDetailsView({ lockedTier }: { lockedTier?: CollectionPriorityTier }) {
  const [items, setItems] = useState<CollectionsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<CollectionPriorityTier | "all">(lockedTier ?? "all");

  useEffect(() => {
    queueMicrotask(() => {
      void fetch("/api/receivables")
        .then(async (res) => {
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (!res.ok) throw new Error(data.error ?? "Failed to load receivables");
          setItems(data.items ?? []);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load receivables"))
        .finally(() => setLoading(false));
    });
  }, []);

  const effectiveTier = lockedTier ?? tierFilter;

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.invoiceId.toLowerCase().includes(search.toLowerCase()) || item.customerId.toLowerCase().includes(search.toLowerCase());
      const matchesTier = effectiveTier === "all" || getCollectionPriorityTier(item) === effectiveTier;
      return matchesSearch && matchesTier;
    });
  }, [effectiveTier, items, search]);

  const grouped = useMemo(() => groupCollectionsByPriority(items), [items]);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const filteredAmount = filtered.reduce((sum, item) => sum + item.amount, 0);
  const title = lockedTier
    ? `${COLLECTION_PRIORITY_META[lockedTier].label} Collections — Detail`
    : "Collections Priority — Full List";
  const description = lockedTier
    ? `${COLLECTION_PRIORITY_META[lockedTier].description} Search, review, and export this priority band.`
    : "All overdue invoices, grouped by ERP-style collection urgency.";

  function handleExport() {
    downloadCsv(
      lockedTier ? `collections-${lockedTier}.csv` : "collections-priority.csv",
      filtered.map((item) => ({
        invoiceId: item.invoiceId,
        customerId: item.customerId,
        priorityBand: COLLECTION_PRIORITY_META[getCollectionPriorityTier(item)].label,
        amount: item.amount,
        daysOverdue: item.daysOverdue,
        priorityScore: item.priorityScore,
      }))
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/#receivables" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>

      <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <Link
          href="/#receivables"
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          Dashboard
        </Link>
        <TabLink href={COLLECTION_DETAILS_BASE_PATH} active={!lockedTier}>
          View full list & export
        </TabLink>
        {COLLECTION_PRIORITY_ORDER.map((tier) => (
          <TabLink key={tier} href={getCollectionTierDetailsHref(tier)} active={lockedTier === tier}>
            {COLLECTION_PRIORITY_META[tier].label}
          </TabLink>
        ))}
      </nav>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {grouped.map((group) => {
          const meta = COLLECTION_PRIORITY_META[group.tier];
          return (
            <Link
              key={group.tier}
              href={getCollectionTierDetailsHref(group.tier)}
              className={`rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${meta.panelClassName}`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{meta.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{group.count}</p>
              <p className="mt-1 text-sm text-slate-600">{fmtMoney(group.totalAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {percentageLabel(group.totalAmount, totalAmount)} of overdue value
              </p>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice or customer…"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        {!lockedTier && (
          <div className="flex flex-wrap rounded-md border border-slate-300 p-0.5">
            {TIER_OPTIONS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter(tier)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  tierFilter === tier ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tier === "all" ? "All" : COLLECTION_PRIORITY_META[tier].label}
              </button>
            ))}
          </div>
        )}
        <span className="text-xs text-slate-400">
          {filtered.length} of {items.length} invoices · {fmtMoney(filteredAmount)}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <ReceivablesTable items={filtered} />}
      </div>
    </main>
  );
}

function TabLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}
