"use client";

import { useEffect, useState } from "react";
import { DeadStockTable } from "@/components/DeadStockTable";
import type { DeadStockItem } from "@/agents/inventory-agent";

export default function InventoryPage() {
  const [items, setItems] = useState<DeadStockItem[]>([]);

  useEffect(() => {
    fetch("/api/inventory?companyId=acme")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-3xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold">Dead Stock</h1>
      <DeadStockTable items={items} />
    </main>
  );
}
