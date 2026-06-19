import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { deadStockTool } from "./tools";

export interface DeadStockItem {
  sku: string;
  daysOfSupply: number;
  suggestedDiscountPct: number;
}

// Ranks SKUs by sales velocity vs quantity on hand and flags slow movers
// with a suggested liquidation discount.
export async function runInventoryAgent(companyId: string): Promise<DeadStockItem[]> {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [deadStockTool],
    tool_choice: { type: "tool", name: deadStockTool.name },
    messages: [
      {
        role: "user",
        content: `Identify slow-moving inventory for company ${companyId} from SKU sales velocity vs quantity on hand, and suggest a liquidation discount for each.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: DeadStockItem[] }).items;
}
