import { NextRequest, NextResponse } from "next/server";
import { runReceivablesAgent } from "@/agents/receivables-agent";

// Returns overdue invoices ranked by collections priority.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const items = await runReceivablesAgent(companyId);
  return NextResponse.json({ items });
}
