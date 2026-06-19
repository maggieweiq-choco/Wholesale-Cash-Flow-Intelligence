import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { collectionsPriorityTool } from "./tools";

export interface CollectionsItem {
  invoiceId: string;
  customerId: string;
  amount: number;
  daysOverdue: number;
  priorityScore: number;
}

// Ranks overdue invoices by aging x amount x customer late-payment
// probability so collections effort goes to the highest-impact accounts first.
export async function runReceivablesAgent(companyId: string): Promise<CollectionsItem[]> {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [collectionsPriorityTool],
    tool_choice: { type: "tool", name: collectionsPriorityTool.name },
    messages: [
      {
        role: "user",
        content: `Rank overdue invoices for company ${companyId} by collections priority, weighing aging, amount, and customer payment history.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: CollectionsItem[] }).items;
}
