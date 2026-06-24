"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CashflowChart } from "@/components/CashflowChart";
import type { CashflowDay } from "@/agents/cashflow-agent";

const QUICK_LINKS = [
  {
    href: "/upload",
    title: "Upload Data",
    description: "Bring in sales, inventory, and invoice CSVs",
  },
  {
    href: "/inventory",
    title: "Inventory",
    description: "Dead stock and suggested liquidation discounts",
  },
  {
    href: "/receivables",
    title: "Receivables",
    description: "Collections priority ranked by risk and amount",
  },
  {
    href: "/financing",
    title: "Financing",
    description: "Compare options to close a projected cash gap",
  },
];

export default function DashboardPage() {
  const [companyId, setCompanyId] = useState("acme");
  const [forecast, setForecast] = useState<CashflowDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadForecast(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?companyId=${encodeURIComponent(id)}`);
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
        body: JSON.stringify({ companyId, openingCash: 50_000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Forecast failed");
      setForecast(data.forecast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadForecast(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowestBalance = forecast.length ? Math.min(...forecast.map((d) => d.balance)) : null;
  const firstGapDay = forecast.find((d) => d.gap < 0);
  const hasGap = lowestBalance !== null && lowestBalance < 0;

  return (
    <main className="flex flex-1 flex-col gap-8 max-w-6xl mx-auto w-full px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cash Flow Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            90-day projection grounded in your sales, inventory, and invoice data.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadForecast(companyId);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="Company ID"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={runForecast}
            disabled={running}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {running ? "Running…" : "Run Forecast"}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Opening Cash"
          value="$50,000"
          tone="neutral"
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
          <h2 className="text-sm font-semibold text-slate-900">90-Day Balance Projection</h2>
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

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Explore</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="font-medium text-slate-900">{link.title}</p>
              <p className="mt-1 text-sm text-slate-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
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
