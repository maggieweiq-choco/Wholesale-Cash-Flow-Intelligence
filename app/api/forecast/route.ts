import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { computeCashflowBase } from "@/agents/cashflow-agent";
import { db } from "@/lib/aurora";
import { cashFlowForecast } from "@/db/schema";
import { requireCompanyId } from "@/lib/dal";

// Persists the fresh 90-day forecast, replacing any previous one for this
// company. The forecast math is deterministic and runs before any AI layer,
// so missing credits/API errors never block the core cash-flow analysis.
export async function POST(request: NextRequest) {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { openingCash } = await request.json();

  let forecast;
  try {
    forecast = await computeCashflowBase(companyId, openingCash ?? 50_000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forecast failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

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
  return NextResponse.json({ forecast, worstGap, agentError: null });
}

// Lets the dashboard read the stored forecast without re-running Claude.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(cashFlowForecast)
    .where(eq(cashFlowForecast.companyId, companyId))
    .orderBy(asc(cashFlowForecast.forecastDt));
  return NextResponse.json({ forecast: rows });
}
