"use client";

import { useState } from "react";
import Link from "next/link";

export default function UploadPage() {
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [normalized, setNormalized] = useState(false);

  async function parseResponse(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async function handleSeed() {
    setSeeding(true);
    setStatus(null);
    setSeeded(false);
    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const result = await parseResponse(response);
      if (response.ok) {
        setSeeded(true);
        setStatus({
          text: `Loaded sample data — ${result.counts.sales} sales, ${result.counts.inventory} inventory, ${result.counts.invoices} invoices, ${result.counts.customers} customers`,
          tone: "success",
        });
      } else {
        setStatus({ text: result.error ?? "Failed to load sample data", tone: "error" });
      }
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "Failed to load sample data", tone: "error" });
    } finally {
      setSeeding(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setStatus(null);
    setNormalized(false);
    setUploaded(false);
    try {
      const form = event.currentTarget;
      const pending = (["sales", "inventory", "invoice"] as const)
        .map((type) => ({ type, file: (form.elements.namedItem(type) as HTMLInputElement)?.files?.[0] }))
        .filter((entry) => entry.file);

      if (pending.length === 0) {
        setStatus({ text: "Choose at least one CSV file", tone: "error" });
        return;
      }

      const summaries: string[] = [];
      for (const { type, file } of pending) {
        const formData = new FormData();
        formData.append("type", type);
        formData.append("file", file as File);
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        const result = await parseResponse(response);
        if (!response.ok) throw new Error(`${type}: ${result.error ?? "upload failed"}`);
        summaries.push(`${result.rowCount} ${type}`);
      }
      setUploaded(true);
      setStatus({
        text: `Uploaded ${summaries.join(", ")} rows — next, click "Normalize" below to load it into the dashboard.`,
        tone: "success",
      });
      form.reset();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "Upload failed", tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleNormalize() {
    setNormalizing(true);
    setStatus(null);
    setNormalized(false);
    try {
      const response = await fetch("/api/normalize", { method: "POST" });
      const result = await parseResponse(response);
      if (response.ok) {
        setNormalized(true);
        setStatus({
          text: `Normalized into Aurora — ${result.counts.sales} sales, ${result.counts.inventory} inventory, ${result.counts.invoices} invoices, ${result.counts.customers} customers`,
          tone: "success",
        });
      } else {
        setStatus({ text: result.error ?? "Normalize failed", tone: "error" });
      }
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "Normalize failed", tone: "error" });
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

      <div className="rounded-xl border border-slate-900 bg-slate-900 p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-white">New here? Try it with sample data</h2>
        <p className="mb-4 text-sm text-slate-300">
          Loads pre-built sales, inventory, and invoice CSVs into your workspace so you can see forecasts, dead
          stock, and collections before uploading anything of your own.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50"
          >
            {seeding ? "Loading sample data…" : "Load Sample Data"}
          </button>
          {seeded && (
            <Link href="/" className="text-sm font-medium text-white underline underline-offset-2">
              View Dashboard →
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">1. Upload CSVs</h2>
        <p className="mb-4 text-sm text-slate-500">Pick any combination — sales, inventory, invoices, or all three.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Sales CSV">
            <input
              type="file"
              name="sales"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
          </Field>
          <Field label="Inventory CSV">
            <input
              type="file"
              name="inventory"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
          </Field>
          <Field label="Invoices CSV">
            <input
              type="file"
              name="invoice"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
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

      <div
        className={`rounded-xl border bg-white p-6 shadow-sm ${
          uploaded && !normalized ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">2. Normalize into Aurora</h2>
          {uploaded && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              ✓ Step 1 complete
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-slate-500">
          {uploaded && !normalized
            ? 'Now click "Normalize" to load your upload into the dashboard.'
            : "Cleans your raw rows into typed tables and derives customer payment scores."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleNormalize}
            disabled={normalizing}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {normalizing ? "Normalizing…" : "Normalize"}
          </button>
          {normalized && (
            <Link href="/" className="text-sm font-medium text-slate-900 underline underline-offset-2">
              Return to Dashboard →
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Or connect your ERP</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Coming soon
          </span>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Sync sales, inventory, and invoices automatically — no manual CSV upload.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {["QuickBooks", "NetSuite", "Odoo", "Cin7", "Fishbowl", "Sage"].map((name) => (
            <button
              key={name}
              type="button"
              disabled
              title={`Connect ${name} — coming soon`}
              className="cursor-not-allowed rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
            >
              {name}
            </button>
          ))}
        </div>
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
