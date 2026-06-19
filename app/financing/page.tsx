"use client";

import { useState } from "react";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function FinancingPage() {
  const [recommendation, setRecommendation] = useState<FinancingRecommendation | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/financing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: formData.get("companyId"),
        gapAmount: Number(formData.get("gapAmount")),
      }),
    });
    setRecommendation(await response.json());
  }

  return (
    <main className="flex flex-1 flex-col gap-6 max-w-3xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold">Financing Recommendation</h1>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input name="companyId" placeholder="Company ID" className="border rounded px-3 py-2" required />
        <input name="gapAmount" type="number" placeholder="Gap amount" className="border rounded px-3 py-2" required />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          Compare
        </button>
      </form>
      {recommendation && <FinancingPanel recommendation={recommendation} />}
    </main>
  );
}
