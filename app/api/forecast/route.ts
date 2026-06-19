import { NextRequest, NextResponse } from "next/server";
import { runCashflowAgent } from "@/agents/cashflow-agent";
import { db } from "@/lib/aurora";
import { cashFlowForecast } from "@/db/schema";

// Triggers the cash flow agent for a company and persists the resulting
// 90-day forecast to Aurora.
export async function POST(request: NextRequest) {
  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const forecast = await runCashflowAgent(companyId);

  await db.insert(cashFlowForecast).values(
    forecast.map((day) => ({
      companyId,
      forecastDt: day.date,
      cashIn: String(day.cashIn),
      cashOut: String(day.cashOut),
      balance: String(day.balance),
      gap: String(day.gap),
    }))
  );

  return NextResponse.json({ forecast });
}
