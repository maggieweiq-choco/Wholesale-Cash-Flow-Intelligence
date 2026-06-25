import { NextResponse } from "next/server";
import { runInventoryAgent } from "@/agents/inventory-agent";
import { getCompanyData, getInventoryMetrics } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";

// Returns dead-stock SKUs ranked by days-of-supply with a suggested discount
// (each tagged with its current inventory value for charting), plus
// company-level Days of Inventory Outstanding.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, metrics, companyData] = await Promise.all([
    runInventoryAgent(companyId).catch((err) => ({ error: err instanceof Error ? err.message : "Agent failed" })),
    getInventoryMetrics(companyId),
    getCompanyData(companyId),
  ]);

  const items = Array.isArray(agentResult) ? agentResult : [];
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  const bySku = new Map(companyData.inventory.map((row) => [row.sku, row]));
  const itemsWithValue = items.map((item) => {
    const row = bySku.get(item.sku);
    const inventoryValue = row ? row.qtyOnHand * Number(row.unitCost ?? 0) : 0;
    return { ...item, inventoryValue };
  });

  return NextResponse.json({ items: itemsWithValue, metrics, agentError });
}
