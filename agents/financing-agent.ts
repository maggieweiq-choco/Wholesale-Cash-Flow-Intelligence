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
  agentError?: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function withRecommendedOption(options: LoanScenario[]): LoanScenario[] {
  const viable = options.filter((option) => option.amount > 0);
  const best = viable.reduce<LoanScenario | null>((current, option) => {
    if (!current) return option;
    if (option.amount >= current.amount && option.estimatedCost < current.estimatedCost) return option;
    if (option.amount >= current.amount && option.estimatedCost === current.estimatedCost && option.amount > current.amount) {
      return option;
    }
    return current;
  }, null);

  return options.map((option) => ({
    ...option,
    recommended: best?.optionType === option.optionType,
  }));
}

// Rule-based first pass: size each financing source from real company data
// and estimate its cost with explicit formulas. This lets the software make
// a usable recommendation even when the AI layer has no credits or is down.
export async function computeFinancingBase(
  companyId: string,
  gapAmount: number
): Promise<FinancingRecommendation> {
  const { inventory, invoices } = await getCompanyData(companyId);
  const unpaid = invoices.filter((i) => i.status !== "paid");

  const inventoryValue = inventory.reduce(
    (sum, item) => sum + item.qtyOnHand * Number(item.unitCost ?? 0),
    0
  );
  const unpaidReceivables = unpaid.reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  const bankDurationDays = 90;
  const bankApr = 0.1;
  const liquidationDiscount = 0.25;
  const arAdvanceRate = 0.85;
  const arFeeRate = 0.03;

  const bankLoan: LoanScenario = {
    optionType: "bank_loan",
    amount: round2(gapAmount),
    durationDays: bankDurationDays,
    estimatedCost: round2(gapAmount * bankApr * (bankDurationDays / 365)),
    recommended: false,
  };

  const liquidatableCash = inventoryValue * (1 - liquidationDiscount);
  const liquidateAmount = Math.min(gapAmount, liquidatableCash);
  const liquidate: LoanScenario = {
    optionType: "liquidate",
    amount: round2(liquidateAmount),
    durationDays: 30,
    estimatedCost: round2(liquidateAmount > 0 ? liquidateAmount * (liquidationDiscount / (1 - liquidationDiscount)) : 0),
    recommended: false,
  };

  const arCapacity = unpaidReceivables * arAdvanceRate;
  const arAmount = Math.min(gapAmount, arCapacity);
  const arFinance: LoanScenario = {
    optionType: "ar_finance",
    amount: round2(arAmount),
    durationDays: 45,
    estimatedCost: round2(arAmount * arFeeRate),
    recommended: false,
  };

  return {
    gapAmount: round2(gapAmount),
    options: withRecommendedOption([bankLoan, liquidate, arFinance]),
    agentError: null,
  };
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
