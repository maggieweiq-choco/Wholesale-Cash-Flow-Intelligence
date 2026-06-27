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

interface InvoiceRow {
  id: number;
  customerId: string;
  amount: string;
  dueAt: string;
  status: string | null;
}

interface CustomerRow {
  id: string;
  paymentScore: string | null;
}

// Deterministic aging x amount x customer-unreliability score, computed
// straight from Aurora data with plain arithmetic — this is what renders
// even when Claude is unavailable. The AI call below only re-ranks/refines
// on top, it never invents daysOverdue or amount.
export function computeCollectionsBase(invoices: InvoiceRow[], customers: CustomerRow[]): CollectionsItem[] {
  const today = Date.now();
  const byCustomer = new Map(customers.map((c) => [c.id, c]));

  return invoices
    .filter((inv) => inv.status !== "paid")
    .map((inv) => {
      const daysOverdue = Math.max(0, Math.round((today - new Date(inv.dueAt).getTime()) / 86_400_000));
      const paymentScore = Number(byCustomer.get(inv.customerId)?.paymentScore ?? 5);
      const unreliability = (11 - paymentScore) / 10; // ~0.1 (reliable) to 1.0 (unreliable)
      const amount = Number(inv.amount);
      const priorityScore = Math.round(daysOverdue * amount * unreliability) / 100;
      return { invoiceId: String(inv.id), customerId: inv.customerId, amount, daysOverdue, priorityScore };
    })
    .filter((item) => item.daysOverdue > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore);
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
