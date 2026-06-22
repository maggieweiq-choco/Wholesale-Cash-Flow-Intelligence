import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { collectionsPriorityTool } from "./tools";

export interface CollectionsItem {
  invoiceId: string;
  customerId: string;
  amount: number;
  daysOverdue: number;
  priorityScore: number;
}

// Ranks overdue invoices by aging x amount x customer late-payment
// probability so collections effort goes to the highest-impact accounts.
export async function runReceivablesAgent(companyId: string): Promise<CollectionsItem[]> {
  const { invoices, customers } = await getCompanyData(companyId);

  const unpaid = invoices.filter((i) => i.status !== "paid");
  if (unpaid.length === 0) {
    throw new Error(`No unpaid invoices for company ${companyId}. Upload + normalize first.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [collectionsPriorityTool],
    tool_choice: { type: "tool", name: collectionsPriorityTool.name },
    messages: [
      {
        role: "user",
        content: `Rank overdue invoices for company ${companyId} by collections priority.

Today is ${today}. Use ONLY the data below. daysOverdue = today - dueAt (skip invoices not yet due). priorityScore should weigh aging x amount x how unreliable the customer is (lower paymentScore / higher avgDaysLate = more urgent). Use each invoice's "id" field as invoiceId.

UNPAID_INVOICES: ${JSON.stringify(unpaid)}
CUSTOMERS: ${JSON.stringify(customers)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: CollectionsItem[] }).items;
}
