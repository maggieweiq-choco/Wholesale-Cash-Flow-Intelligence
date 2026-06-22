import { NextRequest, NextResponse } from "next/server";
import { runFinancingAgent } from "@/agents/financing-agent";
import { getWorstGap } from "@/lib/queries";

// Compares financing options for the projected cash flow gap. If gapAmount
// isn't supplied, it's derived from the stored forecast (worst day).
export async function POST(request: NextRequest) {
  const { companyId, gapAmount } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const gap = typeof gapAmount === "number" && gapAmount > 0
    ? gapAmount
    : await getWorstGap(companyId);

  if (gap <= 0) {
    return NextResponse.json(
      { error: "No cash flow gap found. Run /api/forecast first or pass gapAmount." },
      { status: 400 }
    );
  }

  const recommendation = await runFinancingAgent(companyId, gap);
  return NextResponse.json(recommendation);
}
