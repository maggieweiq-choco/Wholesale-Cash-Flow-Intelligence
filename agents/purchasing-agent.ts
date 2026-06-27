import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { purchasingRecommendationTool } from "./tools";

export interface PurchasingItem {
  sku: string;
  vendorName?: string;
  daysOfSupply: number;
  recommendedQty: number;
  estimatedCost: number;
  urgency: "reorder_now" | "reorder_soon" | "healthy";
}

interface InventoryRow {
  sku: string;
  qtyOnHand: number;
  unitCost: string | null;
  vendorName?: string | null;
}

interface SalesRow {
  sku: string;
  soldQty: number;
  soldAt: string;
}

const TARGET_DAYS_OF_SUPPLY = 30;

// Deterministic days-of-supply + a reorder-point quantity (enough stock for
// TARGET_DAYS_OF_SUPPLY), computed straight from Aurora data with plain
// arithmetic. This is what renders even when Claude is unavailable — the AI
// call below only adds judgment on top, it never invents the underlying
// numbers.
export function computePurchasingBase(inventory: InventoryRow[], sales: SalesRow[]): PurchasingItem[] {
  const bySku = new Map<string, { totalQty: number; minDate: number; maxDate: number }>();
  for (const s of sales) {
    const t = new Date(s.soldAt).getTime();
    const entry = bySku.get(s.sku) ?? { totalQty: 0, minDate: t, maxDate: t };
    entry.totalQty += s.soldQty;
    entry.minDate = Math.min(entry.minDate, t);
    entry.maxDate = Math.max(entry.maxDate, t);
    bySku.set(s.sku, entry);
  }

  return inventory
    .map((inv) => {
      const sale = bySku.get(inv.sku);
      const spanDays = sale ? Math.max(1, Math.round((sale.maxDate - sale.minDate) / 86_400_000) + 1) : 0;
      const avgDailyVelocity = sale && spanDays > 0 ? sale.totalQty / spanDays : 0;
      const daysOfSupply = avgDailyVelocity > 0 ? Math.round(inv.qtyOnHand / avgDailyVelocity) : 999;

      const targetQty = Math.round(avgDailyVelocity * TARGET_DAYS_OF_SUPPLY);
      const recommendedQty = Math.max(0, targetQty - inv.qtyOnHand);
      const estimatedCost = Math.round(recommendedQty * Number(inv.unitCost ?? 0) * 100) / 100;

      const urgency: PurchasingItem["urgency"] =
        daysOfSupply <= 14 ? "reorder_now" : daysOfSupply <= 30 ? "reorder_soon" : "healthy";

      return {
        sku: inv.sku,
        vendorName: inv.vendorName ?? undefined,
        daysOfSupply,
        recommendedQty,
        estimatedCost,
        urgency,
      };
    })
    .filter((item) => item.urgency !== "healthy" || item.recommendedQty > 0)
    .sort((a, b) => a.daysOfSupply - b.daysOfSupply);
}

// Recommends which SKUs to reorder, how much, and the estimated cost, based
// on real sales velocity vs. inventory on hand — grounded in real Aurora
// data, naming the actual supplier from the inventory row when known.
export async function runPurchasingAgent(companyId: string): Promise<PurchasingItem[]> {
  const { sales, inventory } = await getCompanyData(companyId);

  if (inventory.length === 0) {
    throw new Error(`No inventory for company ${companyId}. Upload + normalize first.`);
  }

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [purchasingRecommendationTool],
    tool_choice: { type: "tool", name: purchasingRecommendationTool.name },
    messages: [
      {
        role: "user",
        content: `Recommend reorders for company ${companyId}.

Use ONLY the data below. For each SKU compute days-of-supply = qtyOnHand / (recent daily sales velocity from SALES_HISTORY). Recommend a reorder quantity that brings the SKU back up to about ${TARGET_DAYS_OF_SUPPLY} days of supply, and estimate the cost using the SKU's unit cost. Mark urgency "reorder_now" for SKUs with under 14 days of supply, "reorder_soon" for under 30, otherwise "healthy" (omit healthy SKUs that need no reorder). Each INVENTORY row has a vendorName — name the actual supplier when known.

INVENTORY: ${JSON.stringify(inventory)}
SALES_HISTORY: ${JSON.stringify(sales)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a recommendation");

  return (toolUse.input as { items: PurchasingItem[] }).items;
}
