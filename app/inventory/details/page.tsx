"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryTierSummary } from "@/components/InventoryTierSummary";
import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { downloadCsv } from "@/lib/csv-export";
import type { SkuTier } from "@/lib/sku-tiers";

const TIER_OPTIONS: (SkuTier | "all")[] = ["all", "A", "B", "C", "D"];

export default function InventoryDetailsPage() {
  const [items, setItems] = useState<DeadStockItemWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<SkuTier | "all">("all");

  useEffect(() => {
    fetch("/api/inventory")
      .then(async (res) => {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error ?? "Failed to load inventory");
        setItems(data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load inventory"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === "all" || item.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [items, search, tierFilter]);

  function handleExport() {
    downloadCsv(
      "dead-stock.csv",
      filtered.map((item) => ({
        sku: item.sku,
        tier: item.tier,
        productType: item.productType,
        daysOfSupply: item.daysOfSupply,
        suggestedDiscountPct: item.suggestedDiscountPct,
        inventoryValue: item.inventoryValue,
        reorderRecommendation: item.reorderRecommendation,
        vendorNegotiationTip: item.vendorNegotiationTip,
      }))
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-5xl mx-auto w-full px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/#inventory" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Dead Stock — Full List</h1>
          <p className="mt-1 text-sm text-slate-500">All SKUs, filterable and exportable.</p>
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

      <InventoryTierSummary items={items} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SKU…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <div className="flex rounded-md border border-slate-300 p-0.5">
          {TIER_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                tierFilter === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t === "all" ? "All" : `Tier ${t}`}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{filtered.length} of {items.length} SKUs</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <DeadStockTable items={filtered} />}
      </div>
    </main>
  );
}
