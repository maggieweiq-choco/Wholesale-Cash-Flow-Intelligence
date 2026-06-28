import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { financingRecommendationTool } from "./tools";
import { TIER_DISCOUNT_PCT, tierSkusByCompositeScore, dedupeBySku, type SkuTier } from "@/lib/sku-tiers";

export interface LoanScenario {
  optionType: "bank_loan" | "liquidate" | "ar_finance";
  amount: number;
  durationDays: number;
  estimatedCost: number;
  recommended: boolean;
}

export interface LiquidationTierBreakdown {
  tier: SkuTier;
  inventoryValue: number;
  discountPct: number;
  cashRaised: number;
  cashUsed: number;
}

export interface FinancingRecommendation {
  gapAmount: number;
  options: LoanScenario[];
  liquidationByTier?: LiquidationTierBreakdown[];
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
  const { inventory: rawInventory, invoices, sales } = await getCompanyData(companyId);
  const inventory = dedupeBySku(rawInventory);
  const unpaid = invoices.filter((i) => i.status !== "paid");

  const unpaidReceivables = unpaid.reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  const bankDurationDays = 90;
  const bankApr = 0.1;
  const arAdvanceRate = 0.85;
  const arFeeRate = 0.03;

  const bankLoan: LoanScenario = {
    optionType: "bank_loan",
    amount: round2(gapAmount),
    durationDays: bankDurationDays,
    estimatedCost: round2(gapAmount * bankApr * (bankDurationDays / 365)),
    recommended: false,
  };

  // Liquidation value is weighted by the same composite-score tier each SKU
  // already gets for dead-stock discounting (lib/sku-tiers.ts) — A-tier
  // stock isn't worth dumping at a discount, D-tier is. A flat haircut
  // ignored that mix entirely.
  const tiers = tierSkusByCompositeScore(inventory, sales);
  const valueByTier = new Map<SkuTier, number>();
  for (const item of inventory) {
    const tier = tiers.get(item.sku) ?? "D";
    const value = item.qtyOnHand * Number(item.unitCost ?? 0);
    valueByTier.set(tier, (valueByTier.get(tier) ?? 0) + value);
  }

  // Consume tiers in order A -> D (cheapest discount first) until the gap is
  // covered. A small gap should be filled from healthy A-stock at ~0% cost,
  // not priced off the whole portfolio's blended discount.
  let remaining = gapAmount;
  let liquidateCost = 0;
  const liquidationByTier: LiquidationTierBreakdown[] = (["A", "B", "C", "D"] as SkuTier[])
    .map((tier) => {
      const inventoryValue = valueByTier.get(tier) ?? 0;
      const discountPct = TIER_DISCOUNT_PCT[tier];
      const tierCashCapacity = inventoryValue * (1 - discountPct / 100);

      const cashUsed = Math.max(0, Math.min(remaining, tierCashCapacity));
      const fractionUsed = tierCashCapacity > 0 ? cashUsed / tierCashCapacity : 0;
      liquidateCost += fractionUsed * inventoryValue * (discountPct / 100);
      remaining -= cashUsed;

      return {
        tier,
        inventoryValue: round2(inventoryValue),
        discountPct,
        cashRaised: round2(tierCashCapacity),
        cashUsed: round2(cashUsed),
      };
    })
    .filter((row) => row.inventoryValue > 0);

  const liquidatableCash = liquidationByTier.reduce((sum, row) => sum + row.cashRaised, 0);
  const liquidateAmount = Math.min(gapAmount, liquidatableCash);
  const liquidate: LoanScenario = {
    optionType: "liquidate",
    amount: round2(liquidateAmount),
    durationDays: 30,
    estimatedCost: round2(liquidateCost),
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
    liquidationByTier,
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
