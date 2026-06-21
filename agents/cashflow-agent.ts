import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { cashflowForecastTool } from "./tools";

export interface CashflowDay {
  date: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number;
}

// Computes a 90-day cash-in vs cash-out timeline grounded in the company's
// actual Aurora data (sales velocity, inventory cost, invoice due dates),
// flagging the day the balance first goes negative.
export async function runCashflowAgent(
  companyId: string,
  openingCash = 50_000
): Promise<CashflowDay[]> {
  const { sales, inventory, invoices } = await getCompanyData(companyId);

  if (invoices.length === 0 && sales.length === 0) {
    throw new Error(`No data for company ${companyId}. Upload + normalize first.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    tools: [cashflowForecastTool],
    tool_choice: { type: "tool", name: cashflowForecastTool.name },
    messages: [
      {
        role: "user",
        content: `Forecast the next 90 days of daily cash flow for company ${companyId}.

Today is ${today}. Opening cash balance is $${openingCash}.

Use ONLY the data below. Cash IN comes mainly from unpaid invoices arriving near their due date (discount expected timing by each customer's payment history if available). Cash OUT comes from recurring operating costs and inventory restock implied by sales velocity. Each day's balance = previous balance + cashIn - cashOut. "gap" is the balance when negative, else 0.

SALES_HISTORY: ${JSON.stringify(sales)}
INVENTORY: ${JSON.stringify(inventory)}
INVOICES: ${JSON.stringify(invoices)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a forecast");

  return (toolUse.input as { days: CashflowDay[] }).days;
}
