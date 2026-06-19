import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { cashflowForecastTool } from "./tools";

export interface CashflowDay {
  date: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number;
}

// Computes a 90-day cash-in vs cash-out timeline for a company from its
// sales history, inventory, and receivables/payables, flagging the day the
// balance first goes negative.
export async function runCashflowAgent(companyId: string): Promise<CashflowDay[]> {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [cashflowForecastTool],
    tool_choice: { type: "tool", name: cashflowForecastTool.name },
    messages: [
      {
        role: "user",
        content: `Forecast the next 90 days of daily cash flow for company ${companyId} based on sales history, inventory, and outstanding receivables/payables.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a forecast");

  return (toolUse.input as { days: CashflowDay[] }).days;
}
