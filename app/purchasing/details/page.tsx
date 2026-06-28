"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PurchasingTable } from "@/components/PurchasingTable";
import { PurchasingTierSummary } from "@/components/PurchasingTierSummary";
import { TierFilterButtons } from "@/components/TierFilterButtons";
import type { PurchasingItem } from "@/agents/purchasing-agent";
import { downloadCsv } from "@/lib/csv-export";
import type { SkuTier } from "@/lib/sku-tiers";

const VALID_TIERS: SkuTier[] = ["A", "B", "C", "D"];

export default function PurchasingDetailsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<PurchasingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Seeded from the dashboard's filter state (passed via ?search=&tiers=) so
  // following "View full list" doesn't make you re-apply the same filters.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [tierFilter, setTierFilter] = useState<Set<SkuTier>>(
    () => new Set((searchParams.get("tiers")?.split(",").filter((t): t is SkuTier => VALID_TIERS.includes(t as SkuTier)) ?? []))
  );

  useEffect(() => {
    fetch("/api/purchasing")
      .then(async (res) => {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error ?? "Failed to load purchasing recommendations");
        setItems(data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load purchasing recommendations"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter.size === 0 || tierFilter.has(item.tier);
      return matchesSearch && matchesTier;
    });
  }, [items, search, tierFilter]);

  function handleExport() {
    downloadCsv(
      "purchasing-recommendations.csv",
      filtered.map((item) => ({
        sku: item.sku,
        tier: item.tier,
        vendorName: item.vendorName ?? "",
        daysOfSupply: item.daysOfSupply,
        recommendedQty: item.recommendedQty,
        estimatedCost: item.estimatedCost,
        urgency: item.urgency,
      }))
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-5xl mx-auto w-full px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/#purchasing" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Purchasing — Full List</h1>
          <p className="mt-1 text-sm text-slate-500">All reorder recommendations, filterable and exportable.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <PurchasingTierSummary items={items} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SKU…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <TierFilterButtons selected={tierFilter} onChange={setTierFilter} />
        {(search || tierFilter.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTierFilter(new Set());
            }}
            className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400">{filtered.length} of {items.length} SKUs</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <PurchasingTable items={filtered} />}
      </div>
    </main>
  );
}
