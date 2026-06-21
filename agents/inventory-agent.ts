import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { deadStockTool } from "./tools";

export interface DeadStockItem {
  sku: string;
  daysOfSupply: number;
  suggestedDiscountPct: number;
}

// Ranks SKUs by sales velocity vs quantity on hand and flags slow movers
// with a suggested liquidation discount — grounded in real Aurora data.
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

INVENTORY: ${JSON.stringify(inventory)}
SALES_HISTORY: ${JSON.stringify(sales)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: DeadStockItem[] }).items;
}
