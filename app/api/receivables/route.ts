import { NextResponse } from "next/server";
import { computeCollectionsBase, runReceivablesAgent } from "@/agents/receivables-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";
import { describeAgentError } from "@/lib/claude";

// Returns overdue invoices ranked by collections priority. The base
// ranking (aging x amount x customer reliability) is always the
// deterministic calc; Claude's refined priorityScore is layered on top
// when available, but its absence never hides the underlying invoices.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, companyData] = await Promise.all([
    runReceivablesAgent(companyId).catch((err) => ({
      error: err instanceof Error && err.message.includes("Upload + normalize first") ? err.message : describeAgentError(),
    })),
    getCompanyData(companyId),
  ]);

  const items = Array.isArray(agentResult)
    ? agentResult
    : computeCollectionsBase(companyData.invoices, companyData.customers);
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  return NextResponse.json({ items, agentError });
}
