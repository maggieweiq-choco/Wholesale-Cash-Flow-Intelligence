import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { computeInventoryBase, runInventoryAgent } from "@/agents/inventory-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";
import { describeAgentError } from "@/lib/claude";
import { parseCsv } from "@/lib/csv-parser";

async function loadSeedWipBySku() {
  const contents = await readFile(join(process.cwd(), "seed", "inventory.csv"), "utf-8");
  const rows = parseCsv(contents);
  const seedWipBySku = new Map<string, number>();

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) continue;
    const qtyWip = Number(row.qty_wip ?? 0);
    if (!Number.isFinite(qtyWip)) continue;
    seedWipBySku.set(sku, qtyWip);
  }

  return seedWipBySku;
}

// Returns dead-stock SKUs ranked by days-of-supply with a suggested discount
// (each tagged with its current inventory value for charting), plus
// company-level Days of Inventory Outstanding. The days-of-supply/discount
// numbers are always the deterministic base calc; Claude's reorder/vendor
// copy is layered on top when available, but its absence never hides data.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [agentResult, companyData, seedWipBySku] = await Promise.all([
    runInventoryAgent(companyId).catch((err) => ({
      // "No data yet" is a real, actionable message; anything else (no key,
      // no credits, rate limit, etc.) is just the AI layer being down.
      error: err instanceof Error && err.message.includes("Upload + normalize first") ? err.message : describeAgentError(),
    })),
    getCompanyData(companyId),
    loadSeedWipBySku().catch(() => new Map<string, number>()),
  ]);

  const baseItems = computeInventoryBase(companyData.inventory, companyData.sales);
  const baseBySku = new Map(baseItems.map((item) => [item.sku, item]));
  const agentError = Array.isArray(agentResult) ? null : agentResult.error;

  // Claude (when available) only contributes reorderRecommendation /
  // vendorNegotiationTip copy — daysOfSupply, suggestedDiscountPct, and
  // tier always come from the fixed deterministic rule so the numbers
  // shown are never AI judgment calls.
  const items = Array.isArray(agentResult)
    ? agentResult.map((aiItem) => {
        const base = baseBySku.get(aiItem.sku);
        return base
          ? { ...base, reorderRecommendation: aiItem.reorderRecommendation, vendorNegotiationTip: aiItem.vendorNegotiationTip }
          : aiItem;
      })
    : baseItems;

  // Final safety net: guarantee one row per SKU even if Claude echoed a
  // duplicate from a stale/unclean inventory snapshot.
  const uniqueItems = [...new Map(items.map((item) => [item.sku, item])).values()];

  const bySku = new Map(companyData.inventory.map((row) => [row.sku, row]));
  const itemsWithValue = uniqueItems.map((item) => {
    const row = bySku.get(item.sku);
    const inventoryValue = row ? row.qtyOnHand * Number(row.unitCost ?? 0) : 0;
    const fallbackWip = seedWipBySku.get(item.sku.trim()) ?? 0;
    const wipQty = row?.qtyWip && row.qtyWip > 0 ? row.qtyWip : fallbackWip;
    const wipValue = wipQty * Number(row?.unitCost ?? 0);
    const totalSupplyQty = (row?.qtyOnHand ?? 0) + wipQty;
    return {
      ...item,
      inventoryValue,
      wipQty,
      wipValue,
      totalSupplyQty,
      vendorName: row?.vendorName ?? null,
      vendorCountry: row?.vendorCountry ?? null,
    };
  });

  const totalInventoryValue = itemsWithValue.reduce((sum, item) => sum + item.inventoryValue, 0);
  const totalWipUnits = itemsWithValue.reduce((sum, item) => sum + item.wipQty, 0);
  const totalWipValue = itemsWithValue.reduce((sum, item) => sum + item.wipValue, 0);
  const totalOnHandUnits = itemsWithValue.reduce((sum, item) => sum + (item.totalSupplyQty - item.wipQty), 0);
  const totalSupplyUnits = itemsWithValue.reduce((sum, item) => sum + item.totalSupplyQty, 0);
  const totalSupplyValue = totalInventoryValue + totalWipValue;
  const wipShareOfSupplyValue = totalSupplyValue > 0 ? totalWipValue / totalSupplyValue : 0;
  const unitCostBySku = new Map(itemsWithValue.map((item) => [item.sku, item.inventoryValue / Math.max(item.totalSupplyQty - item.wipQty, 1)]));
  const totalCogs = companyData.sales.reduce((sum, row) => sum + row.soldQty * (unitCostBySku.get(row.sku) ?? 0), 0);
  const soldDates = companyData.sales.map((row) => new Date(row.soldAt).getTime());
  const spanDays = soldDates.length
    ? Math.max(1, Math.round((Math.max(...soldDates) - Math.min(...soldDates)) / 86_400_000) + 1)
    : 0;
  const avgDailyCogs = spanDays > 0 ? totalCogs / spanDays : 0;
  const daysOfInventoryOutstanding = avgDailyCogs > 0 ? totalInventoryValue / avgDailyCogs : null;

  const metrics = {
    totalInventoryValue,
    totalOnHandUnits,
    totalWipUnits,
    totalWipValue,
    totalSupplyUnits,
    totalSupplyValue,
    wipShareOfSupplyValue,
    avgDailyCogs,
    daysOfInventoryOutstanding,
  };

  return NextResponse.json({ items: itemsWithValue, metrics, agentError });
}
