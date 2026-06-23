"use client";

import { useState } from "react";

export default function UploadPage() {
  const [companyId, setCompanyId] = useState("acme");
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();
      setStatus(
        response.ok
          ? { text: `Uploaded ${result.rowCount} rows`, tone: "success" }
          : { text: result.error, tone: "error" }
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleNormalize() {
    setNormalizing(true);
    setStatus(null);
    try {
      const response = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const result = await response.json();
      setStatus(
        response.ok
          ? {
              text: `Normalized into Aurora — ${result.counts.sales} sales, ${result.counts.inventory} inventory, ${result.counts.invoices} invoices, ${result.counts.customers} customers`,
              tone: "success",
            }
          : { text: result.error, tone: "error" }
      );
    } finally {
      setNormalizing(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-xl mx-auto w-full px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Step 1: upload raw CSVs. Step 2: normalize into Aurora so the agents have clean data to work from.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">1. Upload CSV</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Company ID">
            <input
              name="companyId"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="acme"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              required
            />
          </Field>
          <Field label="Data Type">
            <select
              name="type"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              required
            >
              <option value="sales">Sales</option>
              <option value="inventory">Inventory</option>
              <option value="invoice">Invoices</option>
            </select>
          </Field>
          <Field label="CSV File">
            <input
              type="file"
              name="file"
              accept=".csv"
              className="text-sm text-slate-600"
              required
            />
          </Field>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">2. Normalize into Aurora</h2>
        <p className="mb-4 text-sm text-slate-500">
          Cleans the raw rows for <span className="font-medium text-slate-700">{companyId || "—"}</span> into typed
          tables and derives customer payment scores.
        </p>
        <button
          type="button"
          onClick={handleNormalize}
          disabled={normalizing || !companyId}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {normalizing ? "Normalizing…" : "Normalize"}
        </button>
      </div>

      {status && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
