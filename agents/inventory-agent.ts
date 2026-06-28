import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { getCompanyData } from "@/lib/queries";
import { deadStockTool } from "./tools";
import { TIER_DISCOUNT_PCT, tierSkusBySalesVelocity, productTypeBySku, type SkuTier } from "@/lib/sku-tiers";

export interface DeadStockItem {
  sku: string;
  daysOfSupply: number;
  suggestedDiscountPct: number;
  tier: SkuTier;
  productType: "Stock" | "Reorder";
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
  customerId?: string | null;
}

// Discount and reorder priority both follow one fixed, auditable rule — a
// SKU's sales-velocity tier (lib/sku-tiers.ts) — rather than free-form AI
// judgment. Days-of-supply is computed straight from Aurora data with plain
// arithmetic; this is what renders even when Claude is unavailable. Claude
// only adds judgment-based copy (reorderRecommendation/vendorNegotiationTip)
// on top — it never changes the discount number or the tier.
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

  const tiers = tierSkusBySalesVelocity(inventory.map((i) => i.sku), sales);
  const productTypes = productTypeBySku(inventory.map((i) => i.sku), sales);

  return inventory.map((inv) => {
    const sale = bySku.get(inv.sku);
    const spanDays = sale ? Math.max(1, Math.round((sale.maxDate - sale.minDate) / 86_400_000) + 1) : 0;
    const avgDailyVelocity = sale && spanDays > 0 ? sale.totalQty / spanDays : 0;
    const daysOfSupply = avgDailyVelocity > 0 ? Math.round(inv.qtyOnHand / avgDailyVelocity) : 999;

    const tier = tiers.get(inv.sku) ?? "D";
    const suggestedDiscountPct = TIER_DISCOUNT_PCT[tier];

    // "Stock" if most sales are a customer's first purchase of this SKU
    // (new-customer item); "Reorder" if most are repeat purchases by
    // returning customers (see lib/sku-tiers.ts productTypeBySku).
    const productType = productTypes.get(inv.sku) ?? "Stock";

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

    return {
      sku: inv.sku,
      daysOfSupply,
      suggestedDiscountPct,
      tier,
      productType,
      reorderRecommendation,
      vendorNegotiationTip,
    };
  });
}

// Adds Claude-written reorder/vendor-negotiation copy on top of the
// deterministic base items, grounded in real Aurora data. Inventory rows
// carry the real supplier name/country, so the negotiation tip names the
// actual vendor to contact instead of speaking generically. Discount and
// tier are never touched here — see computeInventoryBase.
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
        content: `Write reorder and vendor-negotiation guidance for company ${companyId}'s slow-moving inventory.

Use ONLY the data below. For each SKU compute days-of-supply = qtyOnHand / (recent daily sales velocity from SALES_HISTORY).

For each SKU give two short, practical recommendations:
- reorderRecommendation: how to reduce holding costs going forward — e.g. for very overstocked SKUs suggest switching to smaller, more frequent (just-in-time) reorder batches or pausing the next reorder; for healthy SKUs say the current cadence is fine.
- vendorNegotiationTip: whether this SKU is overstocked enough to be worth raising with its supplier — e.g. asking for consignment terms (pay only once it sells) or extended payment terms on the next order; for healthy SKUs say "No action needed". Each INVENTORY row has a vendorName and vendorCountry — name the actual supplier in the tip (e.g. "Raise with Royal Darts Ltd (GB) — ...") instead of speaking generically. If vendorName is missing, omit the name.

Also report daysOfSupply and a placeholder suggestedDiscountPct (it will be overridden by a fixed tiering rule, so just estimate it the same way as before).

INVENTORY: ${JSON.stringify(inventory)}
SALES_HISTORY: ${JSON.stringify(sales)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Agent did not return a ranking");

  return (toolUse.input as { items: DeadStockItem[] }).items;
}
