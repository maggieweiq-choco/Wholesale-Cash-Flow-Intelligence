"use client";

import { useEffect, useState } from "react";
import { CashflowChart } from "@/components/CashflowChart";
import { RiskAlerts, type RiskAlert } from "@/components/RiskAlerts";
import { DeadStockTable } from "@/components/DeadStockTable";
import { InventoryBubbleChart, type DeadStockItemWithValue } from "@/components/InventoryBubbleChart";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import { PayablesTable } from "@/components/PayablesTable";
import { PurchasingTable } from "@/components/PurchasingTable";
import { FinancingPanel } from "@/components/FinancingPanel";
import type { CashflowDay } from "@/agents/cashflow-agent";
import type { CollectionsItem } from "@/agents/receivables-agent";
import type { PayablesItem } from "@/agents/payables-agent";
import type { PurchasingItem } from "@/agents/purchasing-agent";
import type { FinancingRecommendation } from "@/agents/financing-agent";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <CashFlowSection />
      <SectionDivider />
      <InventorySection />
      <SectionDivider />
      <PurchasingSection />
      <SectionDivider />
      <ReceivablesSection />
      <SectionDivider />
      <PayablesSection />
      <SectionDivider />
      <FinancingSection />
    </main>
  );
}

function SectionDivider() {
  return <div className="border-t border-slate-200" />;
}

function SectionShell({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
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

const HORIZONS = [30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];

interface ProjectionDay {
  date: string;
  dayIndex: number;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number;
}

interface ProjectionData {
  openingCash: number;
  horizonDays: number;
  days: ProjectionDay[];
  lowestBalance: number;
  lowestBalanceDate: string | null;
  firstBreakDate: string | null;
  worstGap: number;
  overdueTotal: number;
  alerts: RiskAlert[];
}

function CashFlowSection() {
  const [openingCash, setOpeningCash] = useState(50_000);

  // Deterministic