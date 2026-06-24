"use client";

import { useEffect, useState } from "react";
import { DeadStockTable } from "@/components/DeadStockTable";
import type { DeadStockItem } from "@/agents/inventory-agent";

export default function InventoryPage() {
  const [companyId, setCompanyId] = useState("acme");
  const [items, setItems] = useState<DeadStockItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?companyId=${encodeURIComponent(id)}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-4xl mx-auto w-full px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dead Stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            SKUs ranked by days of supply, with a suggested liquidation discount.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(companyId);
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
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Refresh
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <DeadStockTable items={items} />
        )}
      </div>
    </main>
  );
}
