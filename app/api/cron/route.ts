import { NextRequest, NextResponse } from "next/server";

// Triggered daily by Vercel Cron (see vercel.json) to refresh every
// company's cash flow forecast.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: fetch all company IDs and call runCashflowAgent for each.

  return NextResponse.json({ ok: true });
}
