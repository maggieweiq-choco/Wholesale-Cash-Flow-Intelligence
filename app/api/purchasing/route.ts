import { NextResponse } from "next/server";
import { computePurchasingBase, runPurchasingAgent } from "@/agents/purchasing-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns reorder recommendations (SKU, qty, estimated cost, urgency). The
// days-of-supply/qty numbers are always the deterministic base calc;
// Claude's judgment-based copy layers on top when available, but its
// absence never hides the underlying recommendations.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, companyData] = await Promise.all([
    runPurchasingAgent(companyId).catch((err) => ({ error: err instanceof Error ? err.message : "Agent failed" })),
    getCompanyData(companyId),
  ]);

  const items = Array.isArray(agentResult)
    ? agentResult
    : computePurchasingBase(companyData.inventory, companyData.sales);
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  return NextResponse.json({ items, agentError });
}
