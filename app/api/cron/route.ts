import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import { invoices, cashFlowForecast } from "@/db/schema";
import { computeCashflowBase } from "@/agents/cashflow-agent";

// Triggered daily by Vercel Cron (see vercel.json) to refresh every
// company's 90-day forecast so the dashboard stays current.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Distinct company IDs that have data.
  const rows = await db.selectDistinct({ companyId: invoices.companyId }).from(invoices);
  const companyIds = rows.map((r) => r.companyId);

  const results: Record<string, number> = {};
  for (const companyId of companyIds) {
    try {
      const forecast = await computeCashflowBase(companyId);
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
      results[companyId] = forecast.length;
    } catch {
      results[companyId] = -1;
    }
  }

  return NextResponse.json({ ok: true, refreshed: results });
}
