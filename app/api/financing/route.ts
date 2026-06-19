import { NextRequest, NextResponse } from "next/server";
import { runFinancingAgent } from "@/agents/financing-agent";

// Compares financing options (bank loan / liquidate / AR finance) for a
// given projected cash flow gap and recommends the cheapest viable mix.
export async function POST(request: NextRequest) {
  const { companyId, gapAmount } = await request.json();
  if (!companyId || typeof gapAmount !== "number") {
    return NextResponse.json({ error: "companyId and gapAmount are required" }, { status: 400 });
  }

  const recommendation = await runFinancingAgent(companyId, gapAmount);
  return NextResponse.json(recommendation);
}
