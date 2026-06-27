"use client";

import { useEffect, useState } from "react";
import { CashflowChart } from "@/components/CashflowChart";
import { RiskAlerts, type RiskAlert } from "@/components/RiskAlerts";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryBubbleChart, type DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import { PayablesTable } from "@/components/PayablesTable";
import { PurchasingTable } from "@/components/PurchasingTable";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { CashflowDay } from "@/agents/cashflow-agent";
import type { CollectionsItem } from "@/agents/receivables-agent";
import type { PayablesItem } from "@/agents/payables-agent";
import type { PurchasingItem } from "@/agents/purchasing-agent";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <CashFlowSection />
      <SectionDivider />
      <InventorySection />
      <SectionDivider />
      <PurchasingSection />
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

function CashFlowSection() {
  const [openingCash, setOpeningCash] = useState(50_000);

  // Deterministic projection (loads on mount, no LLM).
  const [projection, setProjection] = useState<ProjectionData | null>(null);
  const [projLoading, setProjLoading] = useState(false);

  // AI forecast (runs on demand). One 90-day run, sliced by the toggle.
  const [forecast, setForecast] = useState<CashflowDay[]>([]);
  const [aiAlerts, setAiAlerts] = useState<RiskAlert[]>([]);
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [running, setRunning] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadProjection() {
    setProjLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projection?openingCash=${openingCash}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load projection");
      setProjection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projection");
    } finally {
      setProjLoading(false);
    }
  }

  async function runForecast() {
    setRunning(true);
    setError(null);
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
      setAiAlerts(data.aiAlerts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadProjection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30/60/90 = first N days of the single 90-day run (day 0..N).
  const slicedForecast = forecast.slice(0, horizon + 1);
  const allAlerts = [...(projection?.alerts ?? []), ...aiAlerts];

  const projLowest = projection?.lowestBalance ?? null;
  const projHasGap = projLowest !== null && projLowest < 0;

  return (
    <SectionShell
      id="forecast"
      title="Cash Flow Overview"
      description="Separate deterministic projection, AI forecast, and risk alerts into three clear layers."
      action={
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Opening Cash ($)</span>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={loadProjection}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {projLoading ? "Updating..." : "Refresh Projection"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cash Projection</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Real invoices and scheduled outflows rolled forward to the last due date
              {projection ? ` (${projection.horizonDays} days)` : ""}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
            Deterministic
          </span>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Opening Cash"
            value={`$${(projection?.openingCash ?? openingCash).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <KpiCard
            label="Lowest Balance"
            value={projLowest !== null ? `$${projLowest.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            tone={projHasGap ? "negative" : "positive"}
          />
          <KpiCard
            label="First Breakpoint"
            value={projection?.firstBreakDate ?? (projection ? "None" : "—")}
            tone={projection?.firstBreakDate ? "negative" : "positive"}
          />
        </div>

        {projection && projection.days.length > 0 ? (
          <CashflowChart
            data={projection.days}
            breakDate={projection.firstBreakDate}
            lowest={
              projection.lowestBalanceDate
                ? { date: projection.lowestBalanceDate, balance: projection.lowestBalance }
                : null
            }
          />
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">
            {projLoading ? "Loading..." : "No projection data yet."}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI Forecast</h3>
            <p className="mt-0.5 text-xs text-slate-500">AI extends the projection with forward-looking sales receipts</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`px-3.5 py-1.5 text-xs font-medium ${
                    horizon === h ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
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
              {running ? "Running..." : "Run Forecast"}
            </button>
          </div>
        </div>

        {forecast.length > 0 ? (
          <CashflowChart data={slicedForecast} />
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">
            No forecast yet. Click &ldquo;Run Forecast&rdquo; to generate a 90-day AI forecast, then switch between 30, 60, and 90 days.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Risk Alerts</h3>
          {projection && (
            <span className="text-xs text-slate-400">
              Overdue receivables outstanding: ${projection.overdueTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <RiskAlerts alerts={allAlerts} />
        {aiAlerts.length === 0 && projection && (
          <p className="mt-2 text-xs text-slate-400">
            After you run the AI forecast, this section will append judgment-based alerts labeled &ldquo;AI Alert&rdquo;.
          </p>
        )}
      </div>
    </SectionShell>
  );
}

interface InventoryMetrics {
  totalInventoryValue: number;
  avgDailyCogs: number;
  daysOfInventoryOutstanding: number | null;
}

function InventorySection() {
  const [items, setItems] = useState<DeadStockItemWithValue[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load inventory");
      setItems(data.items ?? []);
      setMetrics(data.metrics ?? null);
      setError(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
      setItems([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">库存金额 × 库龄</h3>
        <p className="mb-2 text-xs text-slate-400">Bubble size = suggested liquidation discount</p>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : <InventoryBubbleChart items={items} />}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <DeadStockTable items={items} />
        )}
      </div>
    </SectionShell>
  );
}

function PurchasingSection() {
  const [items, setItems] = useState<PurchasingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchasing");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load purchasing recommendations");
      setItems(data.items ?? []);
      setError(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchasing recommendations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalEstimatedCost = items
    .filter((item) => item.recommendedQty > 0)
    .reduce((sum, item) => sum + item.estimatedCost, 0);
  const urgentCount = items.filter((item) => item.urgency === "reorder_now").length;

  return (
    <SectionShell
      id="purchasing"
      title="Purchase Planning"
      description="SKUs that need reordering, with quantity and cost grounded in real sales velocity and unit cost — feeds the cash flow forecast."
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

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Estimated Restock Cost"
          value={`$${totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiCard label="SKUs Needing Reorder Now" value={String(urgentCount)} tone={urgentCount > 0 ? "negative" : "positive"} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <PurchasingTable items={items} />
        )}
      </div>
    </SectionShell>
  );
}

function ReceivablesSection() {
  const [items, setItems] = useState<CollectionsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/receivables");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load receivables");
      setItems(data.items ?? []);
      setError(data.agentError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receivables");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <SectionShell
      id="receivables"
      title="Collections Priority"
      description="Overdue invoices ranked by aging, amount, and customer payment history."
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

      <div className="rounded-xl border border-slate-200 bg-white p-6
