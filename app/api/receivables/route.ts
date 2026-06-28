import { NextResponse } from "next/server";
import { computeCollectionsBase } from "@/agents/receivables-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns overdue invoices ranked by collections priority using a fixed,
// auditable aging x amount x customer reliability formula. AI is not part of
// the default data-load path.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const companyData = await getCompanyData(companyId);
  const items = computeCollectionsBase(companyData.invoices, companyData.customers);

  return NextResponse.json({ items, agentError: null });
}
