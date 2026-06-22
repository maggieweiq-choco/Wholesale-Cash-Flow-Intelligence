import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { runCashflowAgent } from "@/agents/cashflow-agent";
import { db } from "@/lib/aurora";
import { cashFlowForecast } from "@/db/schema";

// Runs the cash flow agent (grounded in Aurora data) and persists the fresh
// 90-day forecast, replacing any previous one for this company.
export async function POST(request: NextRequest) {
  const { companyId, openingCash } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const forecast = await runCashflowAgent(companyId, openingCash ?? 50_000);

  await db.delete(cashFlowForecast).where(eq(cashFlowForecast.companyId, companyId));
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

  const worstGap = Math.min(0, ...forecast.map((d) => d.gap));
  return NextResponse.json({ forecast, worstGap });
}

// Lets the dashboard read the stored forecast without re-running Claude.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const rows = await db
    .select()
    .from(cashFlowForecast)
    .where(eq(cashFlowForecast.companyId, companyId));
  return NextResponse.json({ forecast: rows });
}
