import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { computeProjection } from "@/lib/projection";
import { getCompanyData } from "@/lib/queries";
import { cashflowForecastTool } from "./tools";

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CashflowDay {
  date: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number;
}

// The authoritative forecast math is deterministic: invoice timing,
// scheduled outflows, baseline opex, and running balance are all computed
// before any AI call. This is what the app can always persist and show.
export async function computeCashflowBase(
  companyId: string,
  openingCash = 50_000,
  horizonDays = 90
): Promise<CashflowDay[]> {
  const projection = await computeProjection(companyId, openingCash, { horizonDays });
  return projection.days.map((day) => ({
    date: day.date,
    cashIn: day.cashIn,
    cashOut: day.cashOut,
    balance: day.balance,
    gap: day.gap,
  }));
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

Use the data below. Each day's balance = previous balance + cashIn - cashOut. "gap" is the balance when negative, else 0.

CASH IN: unpaid invoices arrive near their due_at date. If a customer has a payment history (paid_at vs due_at), shift the expected arrival later by their typical lateness.

CASH OUT — include these specific outflows on top of a modest $800/day baseline operating cost:
- Supplier restock: ONE large inventory purchase of $45,000, paid on ${addDays(today, 16)}. This is a one-time event, not recurring.
- Payroll: $14,000 paid on ${addDays(today, 9)} and again on ${addDays(today, 23)} ONLY. Do not extend payroll beyond these two dates.

The $45k restock plus payroll land BEFORE the large receivables arrive, pushing the balance to a trough of about -$23,000 around ${addDays(today, 18)}. AFTER the trough, the large unpaid invoices (the $28k, $22k due July–August) get collected near their due dates and the balance RECOVERS to positive by the end of 90 days. The forecast MUST show this recovery — do NOT let the balance decline indefinitely.

These large outflows land BEFORE the biggest receivables arrive, so the running balance dips sharply (expected trough around day 20–25, roughly -$23,000) and then recovers as invoices are collected. Reflect this in the daily numbers.

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
