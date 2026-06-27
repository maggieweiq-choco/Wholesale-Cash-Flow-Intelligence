import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { payablesPriorityTool } from "./tools";

export interface PayablesItem {
  billId: string;
  vendorId: string;
  amount: number;
  daysUntilDue: number;
  priorityScore: number;
}

interface PayableRow {
  id: number;
  vendorId: string;
  amount: string;
  dueAt: string;
  status: string | null;
}

// Deterministic days-until-due x amount, computed straight from Aurora data —
// this is what renders even when Claude is unavailable. The AI call below
// only refines the ranking on top, it never invents daysUntilDue or amount.
export function computePayablesBase(payables: PayableRow[]): PayablesItem[] {
  const today = Date.now();

  return payables
    .filter((bill) => bill.status !== "paid")
    .map((bill) => {
      const daysUntilDue = Math.round((new Date(bill.dueAt).getTime() - today) / 86_400_000);
      const amount = Number(bill.amount);
      // Bills due sooner (or already overdue) and larger in amount rank higher.
      const urgency = daysUntilDue <= 0 ? 2 : Math.max(0.2, 1 - daysUntilDue / 60);
      const priorityScore = Math.round(amount * urgency) / 100;
      return { billId: String(bill.id), vendorId: bill.vendorId, amount, daysUntilDue, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

// Ranks upcoming vendor bills by payment urgency (due-soon x amount) so cash
// gets allocated to the highest-impact payments first.
export async function runPayablesAgent(companyId: string): Promise<PayablesItem[]> {
  const { payables, vendors } = await getCompanyData(companyId);

  const unpaid = payables.filter((p) => p.status !== "paid");
  if (unpaid.length === 0) {
    throw new Error(`No unpaid bills for company ${companyId}. Upload + normalize first.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [payablesPriorityTool],
    tool_choice: { type: "tool", name: payablesPriorityTool.name },
    messages: [
      {
        role: "user",
        content: `Rank upcoming vendor bills for company ${companyId} by payment urgency.

Today is ${today}. Use ONLY the data below. daysUntilDue = dueAt - today (negative if already overdue). priorityScore should weigh how soon the bill is due against its amount — overdue or near-due large bills are most urgent. Use each bill's "id" field as billId.

UNPAID_PAYABLES: ${JSON.stringify(unpaid)}
VENDORS: ${JSON.stringify(vendors)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: PayablesItem[] }).items;
}
