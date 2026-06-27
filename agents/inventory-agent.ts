import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { deadStockTool } from "./tools";

export interface DeadStockItem {
  sku: string;
  daysOfSupply: number;
  suggestedDiscountPct: number;
  reorderRecommendation: string;
  vendorNegotiationTip: string;
}

interface InventoryRow {
  sku: string;
  qtyOnHand: number;
  vendorName?: string | null;
}

interface SalesRow {
  sku: string;
  soldQty: number;
  soldAt: string;
}

// Deterministic days-of-supply + a rule-of-thumb discount, computed straight
// from Aurora data with plain arithmetic. This is what renders even when
// Claude is unavailable — the AI call below only adds judgment-based
// reorder/vendor copy on top, it never invents the underlying numbers.
export function computeInventoryBase(inventory: InventoryRow[], sales: SalesRow[]): DeadStockItem[] {
  const bySku = new Map<string, { totalQty: number; minDate: number; maxDate: number }>();
  for (const s of sales) {
    const t = new Date(s.soldAt).getTime();
    const entry = bySku.get(s.sku) ?? { totalQty: 0, minDate: t, maxDate: t };
    entry.totalQty += s.soldQty;
    entry.minDate = Math.min(entry.minDate, t);
    entry.maxDate = Math.max(entry.maxDate, t);
    bySku.set(s.sku, entry);
  }

  return inventory.map((inv) => {
    const sale = bySku.get(inv.sku);
    const spanDays = sale ? Math.max(1, Math.round((sale.maxDate - sale.minDate) / 86_400_000) + 1) : 0;
    const avgDailyVelocity = sale && spanDays > 0 ? sale.totalQty / spanDays : 0;
    const daysOfSupply = avgDailyVelocity > 0 ? Math.round(inv.qtyOnHand / avgDailyVelocity) : 999;
    const suggestedDiscountPct = Math.min(50, Math.max(0, Math.round(daysOfSupply / 6)));

    const reorderRecommendation =
      daysOfSupply > 90
        ? "Pause the next reorder — significantly overstocked."
        : daysOfSupply > 30
        ? "Switch to smaller, more frequent (JIT) reorder batches."
        : "Current reorder cadence looks fine.";

    const vendorNegotiationTip =
      daysOfSupply > 60
        ? `Worth raising with${inv.vendorName ? ` ${inv.vendorName}` : " the supplier"} — ask for consignment or extended payment terms.`
        : "No action needed.";

    return { sku: inv.sku, daysOfSupply, suggestedDiscountPct, reorderRecommendation, vendorNegotiationTip };
  });
}

// Ranks SKUs by sales velocity vs quantity on hand and flags slow movers
// with a suggested liquidation discount, a JIT/reorder recommendation to
// cut holding costs, and a vendor-negotiation tip — grounded in real Aurora
// data. Inventory rows carry the real supplier name/country (from
// product-supplier data), so the negotiation tip names the actual vendor
// to contact instead of speaking generically.
export async function runInventoryAgent(companyId: string): Promise<DeadStockItem[]> {
  const { sales, inventory } = await getCompanyData(companyId);

  if (inventory.length === 0) {
    throw new Error(`No inventory for company ${companyId}. Upload + normalize first.`);
  }

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [deadStockTool],
    tool_choice: { type: "tool", name: deadStockTool.name },
    messages: [
      {
        role: "user",
        content: `Identify slow-moving inventory for company ${companyId}.

Use ONLY the data below. For each SKU compute days-of-supply = qtyOnHand / (recent daily sales velocity from SALES_HISTORY). Rank the slowest movers and suggest a liquidation discount that scales with how overstocked they are (deeper discount for higher days-of-supply).

For each SKU also give two short, practical recommendations:
- reorderRecommendation: how to reduce holding costs going forward — e.g. for very overstocked SKUs suggest switching to smaller, more frequent (just-in-time) reorder batches or pausing the next reorder; for healthy SKUs say the current cadence is fine.
- vendorNegotiationTip: whether this SKU is overstocked enough to be worth raising with its supplier — e.g. asking for consignment terms (pay only once it sells) or extended payment terms on the next order; for healthy SKUs say "No action needed". Each INVENTORY row has a vendorName and vendorCountry — name the actual supplier in the tip (e.g. "Raise with Royal Darts Ltd (GB) — ...") instead of speaking generically. If vendorName is missing, omit the name.

INVENTORY: ${JSON.stringify(inventory)}
SALES_HISTORY: ${JSON.stringify(sales)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: DeadStockItem[] }).items;
}
