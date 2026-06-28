import { NextResponse } from "next/server";
import { computePayablesBase } from "@/agents/payables-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns upcoming vendor bills ranked by payment urgency. The base ranking
// (days-until-due x amount) is deterministic and always available.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const companyData = await getCompanyData(companyId);
  const items = computePayablesBase(companyData.payables);

  return NextResponse.json({ items, agentError: null });
}
