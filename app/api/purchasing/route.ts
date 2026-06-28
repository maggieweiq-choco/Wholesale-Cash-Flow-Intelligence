import { NextResponse } from "next/server";
import { computePurchasingBase } from "@/agents/purchasing-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns reorder recommendations (SKU, tier, qty, estimated cost, urgency).
// Every field follows the fixed sales-velocity tiering rule in
// lib/sku-tiers.ts — no AI judgment call, so it's always available and
// always auditable.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const companyData = await getCompanyData(companyId);
  const items = computePurchasingBase(companyData.inventory, companyData.sales);

  return NextResponse.json({ items });
}
