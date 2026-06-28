import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { computeInventoryBase } from "@/agents/inventory-agent";
import { getCompanyData } from "@/lib/queries";
import { requireCompanyId } from "@/lib/dal";
import { parseCsv } from "@/lib/csv-parser";

async function loadSeedWipBySku() {
  const contents = await readFile(join(process.cwd(), "seed", "inventory.csv"), "utf-8");
  const rows = parseCsv(contents);
  const seedWipBySku = new Map<string, number>();

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) continue;
    if (row.qty_wip === undefined || row.qty_wip === null || row.qty_wip === "") continue;
    const qtyWip = Number(row.qty_wip);
    if (!Number.isFinite(qtyWip)) continue;
    seedWipBySku.set(sku, qtyWip);
  }

  return seedWipBySku;
}

// Returns dead-stock SKUs ranked by days-of-supply with a suggested discount
// (each tagged with its current inventory value for charting), plus
// company-level Days of Inventory Outstanding. This endpoint is intentionally
// deterministic by default; AI can be added through a separate enhancement
// path, not as part of every data load.
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [companyData, seedWipBySku] = await Promise.all([
    getCompanyData(companyId),
    loadSeedWipBySku().catch(() => new Map<string, number>()),
  ]);

  const baseItems = computeInventoryBase(companyData.inventory, companyData.sales);

  // Final safety net: guarantee one row per SKU even if Claude echoed a
  // duplicate from a stale/unclean inventory snapshot.
  const uniqueItems = [...new Map(baseItems.map((item) => [item.sku, item])).values()];

  const bySku = new Map(companyData.inventory.map((row) => [row.sku, row]));
  const salesMarginAccumulator = new Map<string, { revenue: number; cogs: number }>();
  const grossMarginBySku = new Map<string, number | null>();
  for (const sale of companyData.sales) {
    const inv = bySku.get(sale.sku);
    const unitCost = Number(inv?.unitCost ?? 0);
    const revenue = Number(sale.revenue ?? 0);
    const cogs = sale.soldQty * unitCost;
    const existing = salesMarginAccumulator.get(sale.sku) ?? { revenue: 0, cogs: 0 };
    existing.revenue += revenue;
    existing.cogs += cogs;
    salesMarginAccumulator.set(sale.sku, existing);
  }
  for (const [sku, totals] of salesMarginAccumulator.entries()) {
    grossMarginBySku.set(sku, totals.revenue > 0 ? ((totals.revenue - totals.cogs) / totals.revenue) * 100 : null);
  }

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
      grossMarginPct: grossMarginBySku.get(item.sku) ?? null,
      vendorLeadTimeDays: row?.vendorLeadTimeDays ?? 14,
      returnRatePct: Number(row?.returnRatePct ?? 0),
      obsoleteRisk: row?.obsoleteRisk ?? "low",
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

  return NextResponse.json({ items: itemsWithValue, metrics, agentError: null });
}
