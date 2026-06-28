import { NextResponse } from "next/server";
import { computeInventoryBase, runInventoryAgent } from "@/agents/inventory-agent";
import { getCompanyData, getInventoryMetrics } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";
import { describeAgentError } from "@/lib/claude";

// Returns dead-stock SKUs ranked by days-of-supply with a suggested discount
// (each tagged with its current inventory value for charting), plus
// company-level Days of Inventory Outstanding. The days-of-supply/discount
// numbers are always the deterministic base calc; Claude's reorder/vendor
// copy is layered on top when available, but its absence never hides data.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, metrics, companyData] = await Promise.all([
    runInventoryAgent(companyId).catch((err) => ({
      // "No data yet" is a real, actionable message; anything else (no key,
      // no credits, rate limit, etc.) is just the AI layer being down.
      error: err instanceof Error && err.message.includes("Upload + normalize first") ? err.message : describeAgentError(),
    })),
    getInventoryMetrics(companyId),
    getCompanyData(companyId),
  ]);

  const baseItems = computeInventoryBase(companyData.inventory, companyData.sales);
  const baseBySku = new Map(baseItems.map((item) => [item.sku, item]));
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  // Claude (when available) only contributes reorderRecommendation /
  // vendorNegotiationTip copy — daysOfSupply, suggestedDiscountPct, and
  // tier always come from the fixed deterministic rule so the numbers
  // shown are never AI judgment calls.
  const items = Array.isArray(agentResult)
    ? agentResult.map((aiItem) => {
        const base = baseBySku.get(aiItem.sku);
        return base
          ? { ...base, reorderRecommendation: aiItem.reorderRecommendation, vendorNegotiationTip: aiItem.vendorNegotiationTip }
          : aiItem;
      })
    : baseItems;

  // Final safety net: guarantee one row per SKU even if Claude echoed a
  // duplicate from a stale/unclean inventory snapshot.
  const uniqueItems = [...new Map(items.map((item) => [item.sku, item])).values()];

  const bySku = new Map(companyData.inventory.map((row) => [row.sku, row]));
  const itemsWithValue = uniqueItems.map((item) => {
    const row = bySku.get(item.sku);
    const inventoryValue = row ? row.qtyOnHand * Number(row.unitCost ?? 0) : 0;
    return { ...item, inventoryValue };
  });

  return NextResponse.json({ items: itemsWithValue, metrics, agentError });
}
