import { NextRequest, NextResponse } from "next/server";
import { runInventoryAgent } from "@/agents/inventory-agent";

// Returns dead-stock SKUs ranked by days-of-supply with a suggested discount.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const items = await runInventoryAgent(companyId);
  return NextResponse.json({ items });
}
