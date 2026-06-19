"use client";

import { useState } from "react";

export default function UploadPage() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    setStatus(response.ok ? `Uploaded ${result.rowCount} rows` : result.error);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold">Upload Data</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input name="companyId" placeholder="Company ID" className="border rounded px-3 py-2" required />
        <select name="type" className="border rounded px-3 py-2" required>
          <option value="sales">Sales</option>
          <option value="inventory">Inventory</option>
          <option value="invoice">Invoices</option>
        </select>
        <input type="file" name="file" accept=".csv" required />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          Upload
        </button>
      </form>
      {status && <p className="text-sm text-zinc-600">{status}</p>}
    </main>
  );
}
