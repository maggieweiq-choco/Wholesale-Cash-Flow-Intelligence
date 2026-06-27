import { NextResponse } from "next/server";
import { computePayablesBase, runPayablesAgent } from "@/agents/payables-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns upcoming vendor bills ranked by payment urgency. The base ranking
// (days-until-due x amount) is always the deterministic calc; Claude's
// refined priorityScore is layered on top when available, but its absence
// never hides the underlying bills.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, companyData] = await Promise.all([
    runPayablesAgent(companyId).catch((err) => ({ error: err instanceof Error ? err.message : "Agent failed" })),
    getCompanyData(companyId),
  ]);

  const items = Array.isArray(agentResult) ? agentResult : computePayablesBase(companyData.payables);
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  return NextResponse.json({ items, agentError });
}
