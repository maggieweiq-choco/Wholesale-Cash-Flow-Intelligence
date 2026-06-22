import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { financingRecommendationTool } from "./tools";

export interface LoanScenario {
  optionType: "bank_loan" | "liquidate" | "ar_finance";
  amount: number;
  durationDays: number;
  estimatedCost: number;
  recommended: boolean;
}

export interface FinancingRecommendation {
  gapAmount: number;
  options: LoanScenario[];
}

// Given a projected cash flow gap, compares closing it via bank loan,
// inventory liquidation, or AR financing using the company's real
// dead-stock value and outstanding receivables as collateral context.
export async function runFinancingAgent(
  companyId: string,
  gapAmount: number
): Promise<FinancingRecommendation> {
  const { inventory, invoices } = await getCompanyData(companyId);
  const unpaid = invoices.filter((i) => i.status !== "paid");

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [financingRecommendationTool],
    tool_choice: { type: "tool", name: financingRecommendationTool.name },
    messages: [
      {
        role: "user",
        content: `Company ${companyId} has a projected cash flow gap of $${gapAmount}.

Compare three ways to close it and recommend the cheapest viable mix:
- bank_loan: assume ~10% APR, cost = principal x rate x days/365.
- liquidate: sell slow inventory at a discount; usable cash is limited by the inventory value below, cost = the discount given up.
- ar_finance: factor unpaid invoices at ~2-3% fee; limited by the receivables below.

Use ONLY the data below to bound how much each option can realistically raise.

INVENTORY: ${JSON.stringify(inventory)}
UNPAID_INVOICES: ${JSON.stringify(unpaid)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a recommendation");

  return toolUse.input as FinancingRecommendation;
}
