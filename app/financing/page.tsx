"use client";

import { useState } from "react";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function FinancingPage() {
  const [recommendation, setRecommendation] = useState<FinancingRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/financing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: formData.get("companyId"),
          gapAmount: Number(formData.get("gapAmount")),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      setRecommendation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-4xl mx-auto w-full px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Financing Recommendation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compare bank loan, inventory liquidation, and AR financing to close a projected cash gap.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Company ID</span>
            <input
              name="companyId"
              defaultValue="acme"
              placeholder="acme"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Gap Amount</span>
            <input
              name="gapAmount"
              type="number"
              placeholder="20000"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              required
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
    </main>
  );
}
