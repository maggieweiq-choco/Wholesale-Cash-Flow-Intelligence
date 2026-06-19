import { claude, CLAUDE_MODEL } from "@/lib/claude";
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
// inventory liquidation, or AR financing and recommends the cheapest viable mix.
export async function runFinancingAgent(companyId: string, gapAmount: number): Promise<FinancingRecommendation> {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [financingRecommendationTool],
    tool_choice: { type: "tool", name: financingRecommendationTool.name },
    messages: [
      {
        role: "user",
        content: `Company ${companyId} has a projected cash flow gap of $${gapAmount}. Compare bank loan, inventory liquidation, and AR financing to close it, and recommend the best option(s).`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a recommendation");

  return toolUse.input as FinancingRecommendation;
}
