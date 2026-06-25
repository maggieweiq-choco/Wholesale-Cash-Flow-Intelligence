"use client";

import { useEffect, useState } from "react";
import { CashflowChart } from "@/components/CashflowChart";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryBubbleChart, type DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { CashflowDay } from "@/agents/cashflow-agent";
import type { CollectionsItem } from "@/agents/receivables-agent";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ForecastSection />
      <SectionDivider />
      <InventorySection />
      <SectionDivider />
      <ReceivablesSection />
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

function ForecastSection() {
  const [openingCash, setOpeningCash] = useState(50_000);
  const [forecast, setForecast] = useState<CashflowDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadForecast() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/forecast");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Failed to load forecast");
      setForecast(
        (data.forecast ?? []).map((d: { forecastDt: string; balance: string; gap: string; cashIn: string; cashOut: string }) => ({
          date: d.forecastDt,
          balance: Number(d.balance),
          gap: Number(d.gap),
          cashIn: Number(d.cashIn),
          cashOut: Number(d.cashOut),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load forecast");
    } finally {
      setLoading(false);
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
      setForecast(data.forecast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadForecast();
  }, []);

  const lowestBalance = forecast.length ? Math.min(...forecast.map((d) => d.balance)) : null;
  const firstGapDay = forecast.find((d) => d.gap < 0);
  const hasGap = lowestBalance !== null && lowestBalance < 0;
  // Opening cash isn't persisted on the forecast rows, so derive it from day
  // one: balance = openingCash + cashIn - cashOut.
  const displayedOpeningCash = forecast.length
    ? forecast[0].balance - forecast[0].cashIn + forecast[0].cashOut
    : openingCash;

  return (
    <SectionShell
      id="forecast"
      title="Cash Flow Overview"
      description="90-day projection grounded in your sales, inventory, and invoice data."
      action={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadForecast();
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
            type="button"
            onClick={runForecast}
            disabled={running}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {running ? "Running…" : "Run Forecast"}
          </button>
        </form>
      }
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Opening Cash"
          value={`$${displayedOpeningCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiCard
          label="Lowest Projected Balance"
          value={lowestBalance !== null ? `$${lowestBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          tone={hasGap ? "negative" : "positive"}
        />
        <KpiCard
          label="First Cash Gap"
          value={firstGapDay ? firstGapDay.date : hasGap ? "—" : "None projected"}
          tone={firstGapDay ? "negative" : "positive"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">90-Day Balance Projection</h3>
          {loading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>
        {forecast.length > 0 ? (
          <CashflowChart data={forecast} />
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">
            No forecast yet — click &ldquo;Run Forecast&rdquo; to generate one.
          </div>
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <ReceivablesTable items={items} />
        )}
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
