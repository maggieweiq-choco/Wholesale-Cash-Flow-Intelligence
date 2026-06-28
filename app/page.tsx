"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CashflowChart } from "@/components/CashflowChart";
import { RiskAlerts, type RiskAlert } from "@/components/RiskAlerts";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryBubbleChart, type DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { InventoryTierSummary } from "@/components/InventoryTierSummary";
import { DiscountDistributionChart } from "@/components/DiscountDistributionChart";
import { TierFilterButtons } from "@/components/TierFilterButtons";
import type { SkuTier } from "@/lib/sku-tiers";
import { ReceivablesPriorityBoard } from "@/components/ReceivablesPriorityBoard";
import { PayablesTable } from "@/components/PayablesTable";
import { PurchasingTable } from "@/components/PurchasingTable";
import { PurchasingTierSummary } from "@/components/PurchasingTierSummary";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { CashflowDay } from "@/agents/cashflow-agent";
import type { CollectionsItem } from "@/agents/receivables-agent";
import type { PayablesItem } from "@/agents/payables-agent";
import type { PurchasingItem } from "@/agents/purchasing-agent";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function DashboardPage() {
  // Shared across Inventory and Purchasing so picking a tier in one filters
  // the other too — both sections are ranking the same SKUs by the same rule.
  const [tierFilter, setTierFilter] = useState<Set<SkuTier>>(new Set());

  return (
    <main className="flex flex-1 flex-col">
      <CashFlowSection />
      <SectionDivider />
      <InventorySection tierFilter={tierFilter} setTierFilter={setTierFilter} />
      <SectionDivider />
      <PurchasingSection tierFilter={tierFilter} setTierFilter={setTierFilter} />
      <SectionDivider />
      <ReceivablesSection />
      <SectionDivider />
      <PayablesSection />
      <SectionDivider />
      <FinancingSection />
    </main>
  );
}

function SectionDivider() {
  return <div className="border-t border-slate-200" />;
}

function SectionShell({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "negative"
      ? "text-red-600"
      : tone === "positive"
      ? "text-emerald-600"
      : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

const HORIZONS = [30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];

interface ProjectionDay {
  date: string;
  dayIndex: number;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number;
}

interface ProjectionData {
  openingCash: number;
  horizonDays: number;
  days: ProjectionDay[];
  lowestBalance: number;
  lowestBalanceDate: string | null;
  firstBreakDate: string | null;
  worstGap: number;
  overdueTotal: number;
  alerts: RiskAlert[];
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CashFlowSection() {
  const [openingCash, setOpeningCash] = useState(50_000);

  // Deterministic projection (real invoice/sales/inventory data, no LLM).
  const [projection, setProjection] = useState<ProjectionData | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  // AI forecast (single 90-day run, sliced client-side by horizon toggle).
  const [forecast, setForecast] = useState<CashflowDay[]>([]);
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [fcLoading, setFcLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [fcError, setFcError] = useState<string | null>(null);

  async function loadProjection() {
    setProjLoading(true);
    setProjError(null);
    try {
      const res = await fetch(`/api/projection?openingCash=${openingCash}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load projection");
      setProjection(data);
    } catch (err) {
      setProjError(err instanceof Error ? err.message : "Failed to load projection");
      setProjection(null);
    } finally {
      setProjLoading(false);
    }
  }

  async function loadForecast() {
    setFcLoading(true);
    setFcError(null);
    try {
      const res = await fetch("/api/forecast");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load forecast");
      setForecast(
        (data.forecast ?? []).map(
          (d: { forecastDt: string; balance: string; gap: string; cashIn: string; cashOut: string }) => ({
            date: d.forecastDt,
            balance: Number(d.balance),
            gap: Number(d.gap),
            cashIn: Number(d.cashIn),
            cashOut: Number(d.cashOut),
          })
        )
      );
    } catch (err) {
      setFcError(err instanceof Error ? err.message : "Failed to load forecast");
    } finally {
      setFcLoading(false);
    }
  }

  async function runForecast() {
    setRunning(true);
    setFcError(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Forecast failed");
      setForecast(data.forecast ?? []);
    } catch (err) {
      setFcError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadProjection();
      void loadForecast();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projChartData = (projection?.days ?? []).map((d) => ({ date: d.date, balance: d.balance }));
  const projLowest =
    projection && projection.lowestBalanceDate
      ? { date: projection.lowestBalanceDate, balance: projection.lowestBalance }
      : null;

  // Slice the single 90-day AI run down to the selected horizon.
  const slicedForecast = forecast.slice(0, horizon);
  const fcLowest = slicedForecast.length ? Math.min(...slicedForecast.map((d) => d.balance)) : null;
  const fcBreakDay = slicedForecast.find((d) => d.gap < 0);
  const fcHasGap = fcLowest !== null && fcLowest < 0;

  return (
    <SectionShell
      id="cashflow"
      title="Cash Flow"
      description="Deterministic projection from real data, an AI forecast, and the risk alerts they surface."
      action={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadProjection();
          }}
          className="flex items-end gap-2"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Opening Cash ($)</span>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              placeholder="Opening cash"
              className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Recalculate
          </button>
        </form>
      }
    >
      {/* ---- Deterministic projection ---- */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Projection</h3>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            Deterministic
          </span>
          {projLoading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>

        {projError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{projError}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Opening Cash" value={fmtMoney(projection?.openingCash)} />
          <KpiCard
            label="Lowest Balance"
            value={fmtMoney(projection?.lowestBalance)}
            tone={projection && projection.lowestBalance < 0 ? "negative" : "positive"}
          />
          <KpiCard
            label="First Cash Gap"
            value={projection?.firstBreakDate ?? (projection ? "None projected" : "—")}
            tone={projection?.firstBreakDate ? "negative" : "positive"}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {projChartData.length > 0 ? (
            <CashflowChart data={projChartData} breakDate={projection?.firstBreakDate} lowest={projLowest} />
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">
              {projLoading ? "Loading…" : "No projection data."}
            </div>
          )}
        </div>
      </div>

      {/* ---- AI forecast ---- */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">AI Forecast</h3>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              AI
            </span>
            {fcLoading && <span className="text-xs text-slate-400">Loading…</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-300 p-0.5">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    horizon === h ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {h}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={runForecast}
              disabled={running}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {running ? "Running…" : "Run AI Forecast"}
            </button>
          </div>
        </div>

        {fcError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fcError}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Horizon" value={`${horizon} days`} />
          <KpiCard label="Lowest Balance" value={fmtMoney(fcLowest)} tone={fcHasGap ? "negative" : "positive"} />
          <KpiCard
            label="First Cash Gap"
            value={fcBreakDay ? fcBreakDay.date : forecast.length ? "None projected" : "—"}
            tone={fcBreakDay ? "negative" : "positive"}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {slicedForecast.length > 0 ? (
            <CashflowChart
              data={slicedForecast.map((d) => ({ date: d.date, balance: d.balance }))}
              breakDate={fcBreakDay?.date}
              lowest={fcLowest !== null && fcBreakDay ? { date: fcBreakDay.date, balance: fcBreakDay.balance } : null}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">
              No forecast yet — click &ldquo;Run AI Forecast&rdquo; to generate one.
            </div>
          )}
        </div>
      </div>

      {/* ---- Risk alerts ---- */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-900">Risk Alerts</h3>
        <RiskAlerts alerts={projection?.alerts ?? []} />
      </div>
    </SectionShell>
  );
}

interface InventoryMetrics {
  totalInventoryValue: number;
  avgDailyCogs: number;
  daysOfInventoryOutstanding: number | null;
}

const PREVIEW_ROWS = 10;

function InventorySection({
  tierFilter,
  setTierFilter,
}: {
  tierFilter: Set<SkuTier>;
  setTierFilter: (next: Set<SkuTier>) => void;
}) {
  const [items, setItems] = useState<DeadStockItemWithValue[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    setAiNotice(null);
    try {
      const res = await fetch("/api/inventory");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load inventory");
      setItems(data.items ?? []);
      setMetrics(data.metrics ?? null);
      setAiNotice(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
      setItems([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  const filtered = items.filter(
    (item) => item.sku.toLowerCase().includes(search.toLowerCase()) && (tierFilter.size === 0 || tierFilter.has(item.tier))
  );
  const preview = filtered.slice(0, PREVIEW_ROWS);
  const detailsHref = `/inventory/details?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(tierFilter.size ? { tiers: [...tierFilter].join(",") } : {}),
  }).toString()}`;

  return (
    <SectionShell
      id="inventory"
      title="Dead Stock"
      description="SKUs ranked by days of supply, with a suggested liquidation discount, reorder/JIT guidance, and vendor-negotiation tips."
      action={
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {aiNotice && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{aiNotice}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Days of Inventory Outstanding"
          value={metrics?.daysOfInventoryOutstanding != null ? `${metrics.daysOfInventoryOutstanding.toFixed(0)}d` : "—"}
        />
        <KpiCard
          label="Total Inventory Value"
          value={metrics ? `$${metrics.totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
        />
        <KpiCard
          label="Avg Daily COGS"
          value={metrics ? `$${metrics.avgDailyCogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
        />
      </div>

      <InventoryTierSummary items={items} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Inventory Value × Days of Supply</h3>
        <p className="mb-2 text-xs text-slate-400">Bubble size = suggested liquidation discount</p>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <InventoryBubbleChart items={items} />}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">SKUs by Discount Tier</h3>
        <p className="mb-2 text-xs text-slate-400">How many SKUs sit at each discount level</p>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <DiscountDistributionChart items={items} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU…"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
        </div>
        <Link href={detailsHref} className="text-sm font-medium text-slate-900 underline underline-offset-2">
          View full list & export ({items.length} SKUs) →
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <DeadStockTable items={preview} />
            {filtered.length > PREVIEW_ROWS && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Showing {PREVIEW_ROWS} of {filtered.length} — see full list for the rest.
              </p>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}

function PurchasingSection({
  tierFilter,
  setTierFilter,
}: {
  tierFilter: Set<SkuTier>;
  setTierFilter: (next: Set<SkuTier>) => void;
}) {
  const [items, setItems] = useState<PurchasingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchasing");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load purchasing recommendations");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchasing recommendations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  const filtered = items.filter(
    (item) => item.sku.toLowerCase().includes(search.toLowerCase()) && (tierFilter.size === 0 || tierFilter.has(item.tier))
  );
  const preview = filtered.slice(0, PREVIEW_ROWS);
  const detailsHref = `/purchasing/details?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(tierFilter.size ? { tiers: [...tierFilter].join(",") } : {}),
  }).toString()}`;

  return (
    <SectionShell
      id="purchasing"
      title="Purchasing Recommendations"
      description="SKUs to reorder, how much, and the estimated cost — based on real sales velocity vs. inventory on hand."
      action={
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <PurchasingTierSummary items={items} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU…"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
        </div>
        <Link href={detailsHref} className="text-sm font-medium text-slate-900 underline underline-offset-2">
          View full list & export ({items.length} SKUs) →
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <PurchasingTable items={preview} />
            {filtered.length > PREVIEW_ROWS && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Showing {PREVIEW_ROWS} of {filtered.length} — see full list for the rest.
              </p>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}

function ReceivablesSection() {
  const [items, setItems] = useState<CollectionsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setAiNotice(null);
    try {
      const res = await fetch("/api/receivables");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load receivables");
      setItems(data.items ?? []);
      setAiNotice(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receivables");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  return (
    <SectionShell
      id="receivables"
      title="Collections Priority"
      description="ERP-style collections queue, grouped from most urgent to routine follow-up."
      action={
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {aiNotice && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{aiNotice}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <ReceivablesPriorityBoard items={items} />
        )}
      </div>
    </SectionShell>
  );
}

function PayablesSection() {
  const [items, setItems] = useState<PayablesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payables");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load payables");
      setItems(data.items ?? []);
      setError(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payables");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  return (
    <SectionShell
      id="payables"
      title="Upcoming Bills"
      description="Vendor bills ranked by payment urgency — due-soon and large bills first."
      action={
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <PayablesTable items={items} />}
      </div>
    </SectionShell>
  );
}

function FinancingSection() {
  const [recommendation, setRecommendation] = useState<FinancingRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const gapAmount = formData.get("gapAmount");
      const response = await fetch("/api/financing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gapAmount: gapAmount ? Number(gapAmount) : undefined,
        }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      setRecommendation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionShell
      id="financing"
      title="Financing Recommendation"
      description="Compare bank loan, inventory liquidation, and AR financing to close a projected cash gap."
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Gap Amount</span>
            <input
              name="gapAmount"
              type="number"
              placeholder="Leave blank to use latest forecast"
              className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {recommendation && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <FinancingPanel recommendation={recommendation} />
        </div>
      )}
    </SectionShell>
  );
}
