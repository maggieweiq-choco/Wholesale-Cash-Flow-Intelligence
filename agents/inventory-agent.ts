import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { deadStockTool } from "./tools";

export interface DeadStockItem {
  sku: string;
  daysOfSupply: number;
  suggestedDiscountPct: number;
  reorderRecommendation: string;
  vendorNegotiationTip: string;
}

// Ranks SKUs by sales velocity vs quantity on hand and flags slow movers
// with a suggested liquidation discount, a JIT/reorder recommendation to
// cut holding costs, and a vendor-negotiation tip — grounded in real Aurora
// data. Inventory rows carry the real supplier name/country (from
// product-supplier data), so the negotiation tip names the actual vendor
// to contact instead of speaking generically.
export async function runInventoryAgent(companyId: string): Promise<DeadStockItem[]> {
  const { sales, inventory } = await getCompanyData(companyId);

  if (inventory.length === 0) {
    throw new Error(`No inventory for company ${companyId}. Upload + normalize first.`);
  }

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [deadStockTool],
    tool_choice: { type: "tool", name: deadStockTool.name },
    messages: [
      {
        role: "user",
        content: `Identify slow-moving inventory for company ${companyId}.

Use ONLY the data below. For each SKU compute days-of-supply = qtyOnHand / (recent daily sales velocity from SALES_HISTORY). Rank the slowest movers and suggest a liquidation discount that scales with how overstocked they are (deeper discount for higher days-of-supply).

For each SKU also give two short, practical recommendations:
- reorderRecommendation: how to reduce holding costs going forward — e.g. for very overstocked SKUs suggest switching to smaller, more frequent (just-in-time) reorder batches or pausing the next reorder; for healthy SKUs say the current cadence is fine.
- vendorNegotiationTip: whether this SKU is overstocked enough to be worth raising with its supplier — e.g. asking for consignment terms (pay only once it sells) or extended payment terms on the next order; for healthy SKUs say "No action needed". Each INVENTORY row has a vendorName and vendorCountry — name the actual supplier in the tip (e.g. "Raise with Royal Darts Ltd (GB) — ...") instead of speaking generically. If vendorName is missing, omit the name.

INVENTORY: ${JSON.stringify(inventory)}
SALES_HISTORY: ${JSON.stringify(sales)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: DeadStockItem[] }).items;
}
