import { NextResponse } from "next/server";
import { runReceivablesAgent } from "@/agents/receivables-agent";
import { requireCompanyId } from "@/lib/dal";

// Returns overdue invoices ranked by collections priority.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const items = await runReceivablesAgent(companyId);
  return NextResponse.json({ items });
}
