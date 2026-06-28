"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryTierSummary } from "@/components/InventoryTierSummary";
import { TierFilterButtons } from "@/components/TierFilterButtons";
import type { DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { InventoryExceptionCards, inventoryExceptionMatches, type InventoryExceptionBucket } from "@/components/InventoryExceptionCards";
import { InventorySupplyChart } from "@/components/InventorySupplyChart";
import { InventoryVendorRiskNotes } from "@/components/InventoryVendorRiskNotes";
import { downloadCsv } from "@/lib/csv-export";
import type { SkuTier } from "@/lib/sku-tiers";

const VALID_TIERS: SkuTier[] = ["A", "B", "C", "D"];
const TAB_OPTIONS = ["all", "wip", "exceptions"] as const;
type InventoryTab = (typeof TAB_OPTIONS)[number];

export default function InventoryDetailsPage() {
  return (
    <Suspense fallback={<DetailsFallback title="Dead Stock — Full List" />}>
      <InventoryDetailsContent />
    </Suspense>
  );
}

function InventoryDetailsContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<DeadStockItemWithValue[]>([]);
  const [metrics, setMetrics] = useState<{
    totalInventoryValue: number;
    totalWipUnits: number;
    totalWipValue: number;
    totalSupplyUnits: number;
    wipShareOfSupplyValue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Seeded from the dashboard's filter state (passed via ?search=&tiers=) so
  // following "View full list" doesn't make you re-apply the same filters.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [tierFilter, setTierFilter] = useState<Set<SkuTier>>(
    () => new Set((searchParams.get("tiers")?.split(",").filter((t): t is SkuTier => VALID_TIERS.includes(t as SkuTier)) ?? []))
  );
  const [activeTab, setActiveTab] = useState<InventoryTab>("all");
  const [supplyView, setSupplyView] = useState<"tier" | "vendor">("tier");
  const [activeExceptionBucket, setActiveExceptionBucket] = useState<InventoryExceptionBucket["id"] | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      void fetch("/api/inventory")
        .then(async (res) => {
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (!res.ok) throw new Error(data.error ?? "Failed to load inventory");
          setItems(data.items ?? []);
          setMetrics(data.metrics ?? null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load inventory"))
        .finally(() => setLoading(false));
    });
  }, []);

  const exceptionSkuSet = useMemo(() => {
    return new Set(
      items.filter((item) => {
        if (activeExceptionBucket) return inventoryExceptionMatches(activeExceptionBucket, item);
        return (
          inventoryExceptionMatches("high_wip_low_sales", item) ||
          inventoryExceptionMatches("wip_dominant", item) ||
          inventoryExceptionMatches("high_value_wip", item)
        );
      }).map((item) => item.sku)
    );
  }, [activeExceptionBucket, items]);

  const filtered = useMemo(() => {
    const base = items.filter((item) => {
      const matchesSearch = item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter.size === 0 || tierFilter.has(item.tier);
      return matchesSearch && matchesTier;
    });

    if (activeTab === "wip") {
      return base
        .filter((item) => item.wipQty > 0)
        .sort((a, b) => b.wipValue - a.wipValue || b.wipQty - a.wipQty);
    }

    if (activeTab === "exceptions") {
      return base
        .filter((item) => exceptionSkuSet.has(item.sku))
        .sort((a, b) => b.wipValue - a.wipValue || b.daysOfSupply - a.daysOfSupply);
    }

    return base;
  }, [activeTab, exceptionSkuSet, items, search, tierFilter]);

  function handleExport() {
    downloadCsv(
      "dead-stock.csv",
      filtered.map((item) => ({
        sku: item.sku,
        tier: item.tier,
        onHandQty: item.totalSupplyQty - item.wipQty,
        wipQty: item.wipQty,
        daysOfSupply: item.daysOfSupply,
        suggestedDiscountPct: item.suggestedDiscountPct,
        inventoryValue: item.inventoryValue,
        wipValue: item.wipValue,
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
          <p className="mt-1 text-sm text-slate-500">All SKUs with on-hand, WIP, and liquidation/reorder context.</p>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="On-hand Value" value={metrics ? `$${metrics.totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
        <MetricCard label="WIP Units" value={metrics ? metrics.totalWipUnits.toLocaleString() : "—"} />
        <MetricCard label="WIP Value" value={metrics ? `$${metrics.totalWipValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
        <MetricCard label="WIP Share" value={metrics ? `${Math.round(metrics.wipShareOfSupplyValue * 100)}%` : "—"} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">On Hand vs WIP</h3>
            <p className="text-xs text-slate-400">ERP supply split across finished stock and unfinished supply.</p>
          </div>
          <div className="flex rounded-md border border-slate-300 p-0.5">
            {(["tier", "vendor"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setSupplyView(view)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  supplyView === view ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {view === "tier" ? "By Tier" : "By Vendor"}
              </button>
            ))}
          </div>
        </div>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <InventorySupplyChart items={items} dimension={supplyView} />}
      </div>

      {supplyView === "vendor" && !loading && <InventoryVendorRiskNotes items={items} />}

      <div className="flex flex-wrap items-center gap-2">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === tab ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab === "all" ? "All Inventory" : tab === "wip" ? "WIP Focus" : "Exceptions"}
          </button>
        ))}
      </div>

      {activeTab === "wip" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          WIP Focus ranks SKUs by unfinished inventory value first, so the biggest cash tied up in production rises to the top.
        </div>
      )}

      {activeTab === "exceptions" && (
        <div className="space-y-4">
          <InventoryExceptionCards items={items} activeBucketId={activeExceptionBucket} onSelectBucket={setActiveExceptionBucket} />
          <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-900">
            Exception view surfaces SKUs with high WIP tied to slow sales, WIP-dominant supply, or unusually high unfinished inventory value.
            {activeExceptionBucket ? " Click the active risk card again to clear that filter." : ""}
          </div>
        </div>
      )}

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
        <span className="text-xs text-slate-400">
          {filtered.length} of {items.length} SKUs
          {activeTab === "wip"
            ? " · sorted by WIP value"
            : activeTab === "exceptions"
            ? activeExceptionBucket
              ? " · filtered to selected exception"
              : " · exception-only list"
            : ""}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <DeadStockTable items={filtered} />}
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DetailsFallback({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col gap-6 max-w-5xl mx-auto w-full px-6 py-10">
      <div>
        <Link href="/#inventory" className="text-xs font-medium text-slate-500 hover:text-slate-900">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </main>
  );
}
