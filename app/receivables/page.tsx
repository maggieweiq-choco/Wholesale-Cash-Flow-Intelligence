"use client";

import { useEffect, useState } from "react";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import type { CollectionsItem } from "@/agents/receivables-agent";

export default function ReceivablesPage() {
  const [items, setItems] = useState<CollectionsItem[]>([]);

  useEffect(() => {
    fetch("/api/receivables?companyId=acme")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-3xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold">Collections Priority</h1>
      <ReceivablesTable items={items} />
    </main>
  );
}
