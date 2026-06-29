"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type CsvType = "sales" | "inventory" | "invoice" | "payable";

const CSV_TYPE_LABEL: Record<CsvType, string> = {
  sales: "Sales",
  inventory: "Inventory",
  invoice: "Invoices",
  payable: "Payables",
};

// Best-effort filename guess so a multi-file drop can be auto-sorted into the
// right slot. Deliberately conservative — ambiguous or unmatched filenames
// fall through to manual assignment rather than risk silently mis-filing data.
function guessCsvType(filename: string): CsvType | null {
  const name = filename.toLowerCase();
  if (/sale/.test(name)) return "sales";
  if (/inventory|stock|\bsku/.test(name)) return "inventory";
  if (/invoice|receivable/.test(name)) return "invoice";
  if (/payable|vendor|\bbill/.test(name)) return "payable";
  return null;
}

export default function UploadPage() {
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [normalized, setNormalized] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [unassigned, setUnassigned] = useState<File[]>([]);
  const salesInputRef = useRef<HTMLInputElement>(null);
  const inventoryInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const payableInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  function slotInputRef(type: CsvType) {
    switch (type) {
      case "sales":
        return salesInputRef;
      case "inventory":
        return inventoryInputRef;
      case "invoice":
        return invoiceInputRef;
      case "payable":
        return payableInputRef;
    }
  }

  // Assigns a File into a native <input type="file"> via DataTransfer so the
  // browser's own "filename chosen" UI stays in sync, and handleSubmit's
  // existing form.elements read-out keeps working unchanged.
  function assignFileToSlot(type: CsvType, file: File) {
    const input = slotInputRef(type).current;
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }

  function handleDroppedFiles(incoming: File[]) {
    const csvFiles = incoming.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    const assigned: string[] = [];
    const stillUnassigned: File[] = [];

    for (const file of csvFiles) {
      const type = guessCsvType(file.name);
      if (type) {
        assignFileToSlot(type, file);
        assigned.push(`${file.name} → ${CSV_TYPE_LABEL[type]}`);
      } else {
        stillUnassigned.push(file);
      }
    }

    if (assigned.length) {
      setStatus({
        text: `Auto-detected ${assigned.join(", ")}. Review the fields below, then click Upload.`,
        tone: "success",
      });
    }
    if (stillUnassigned.length) setUnassigned((prev) => [...prev, ...stillUnassigned]);
  }

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
          text: `Loaded sample data — ${result.counts.sales} sales, ${result.counts.inventory} inventory, ${result.counts.invoices} invoices, ${result.counts.customers} customers, ${result.counts.payables ?? 0} payables, ${result.counts.vendors ?? 0} vendors`,
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
      const pending = (["sales", "inventory", "invoice", "payable"] as const)
        .map((type) => ({ type, file: (form.elements.namedItem(type) as HTMLInputElement)?.files?.[0] }))
        .filter((entry) => entry.file);

      if (pending.length === 0) {
        setStatus({
          text:
            unassigned.length > 0
              ? "Choose at least one CSV file — the dropped files above still need a type assigned."
              : "Choose at least one CSV file",
          tone: "error",
        });
        return;
      }

      const summaries: string[] = [];
      const detectedColumns: string[] = [];
      for (const { type, file } of pending) {
        const formData = new FormData();
        formData.append("type", type);
        formData.append("file", file as File);
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        const result = await parseResponse(response);
        if (!response.ok) throw new Error(`${type}: ${result.error ?? "upload failed"}`);
        summaries.push(`${result.rowCount} ${type}`);
        if (Array.isArray(result.columns)) {
          detectedColumns.push(`${type}: ${result.columns.length} columns`);
        }
      }
      setUploaded(true);
      setStatus({
        text: `Uploaded ${summaries.join(", ")} rows. Detected ${detectedColumns.join(", ")} and preserved the raw columns in DynamoDB — next, click "Normalize" below to load standard fields into the dashboard.`,
        tone: "success",
      });
      form.reset();
      setUnassigned([]);
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
        const columnSummary =
          result.counts.columnsByType && typeof result.counts.columnsByType === "object"
            ? Object.entries(result.counts.columnsByType)
                .map(([type, columns]) => `${type}: ${(columns as string[]).length} columns`)
                .join(", ")
            : "";
        const customColumnSummary =
          result.counts.customColumnsByType && typeof result.counts.customColumnsByType === "object"
            ? Object.entries(result.counts.customColumnsByType)
                .filter(([, columns]) => Array.isArray(columns) && columns.length > 0)
                .map(([type, columns]) => `${type}: ${(columns as string[]).join(", ")}`)
                .join("; ")
            : "";
        setNormalized(true);
        setStatus({
          text: `Normalized into Aurora — ${result.counts.sales} sales, ${result.counts.inventory} inventory, ${result.counts.invoices} invoices, ${result.counts.customers} customers, ${result.counts.payables ?? 0} payables, ${result.counts.vendors ?? 0} vendors${columnSummary ? `. Raw columns preserved in DynamoDB (${columnSummary})` : ""}${customColumnSummary ? `. Custom attributes recognized (${customColumnSummary})` : ""}`,
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

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleDroppedFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => multiInputRef.current?.click()}
          className={`mb-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragging ? "border-slate-900 bg-slate-50" : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <p className="text-sm font-medium text-slate-700">Drag & drop CSVs here, or click to browse</p>
          <p className="text-xs text-slate-400">Drop multiple files at once — we&apos;ll guess sales / inventory / invoices / payables from the filename.</p>
          <input
            ref={multiInputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={(e) => {
              handleDroppedFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {unassigned.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-medium text-amber-800">
              Couldn&apos;t guess these from the filename — assign manually:
            </p>
            <div className="flex flex-col gap-2">
              {unassigned.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{file.name}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const type = e.target.value as CsvType | "";
                      if (!type) return;
                      assignFileToSlot(type, file);
                      setUnassigned((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">Assign to…</option>
                    {(Object.keys(CSV_TYPE_LABEL) as CsvType[]).map((type) => (
                      <option key={type} value={type}>
                        {CSV_TYPE_LABEL[type]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Sales CSV">
            <input
              ref={salesInputRef}
              type="file"
              name="sales"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
          </Field>
          <Field label="Inventory CSV">
            <input
              ref={inventoryInputRef}
              type="file"
              name="inventory"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
          </Field>
          <Field label="Invoices CSV">
            <input
              ref={invoiceInputRef}
              type="file"
              name="invoice"
              accept=".csv"
              className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
          </Field>
          <Field label="Payables CSV">
            <input
              ref={payableInputRef}
              type="file"
              name="payable"
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
