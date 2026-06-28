import { readFile } from "fs/promises";
import { join } from "path";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import type { RawUploadRow } from "@/db/dynamo";
import {
  skuSalesHistory,
  inventory,
  invoices,
  customers,
  payables,
  vendors,
  cashFlowForecast,
} from "@/db/schema";
import { parseCsv } from "@/lib/csv-parser";
import { dynamo, RAW_TABLE_NAME } from "@/lib/dynamo";

function isMissingWipColumnError(error: unknown): boolean {
  return error instanceof Error && /qty_wip|column .* does not exist/i.test(error.message);
}

async function readRawInventoryRows(companyId: string): Promise<Record<string, string>[]> {
  const rows: RawUploadRow[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: RAW_TABLE_NAME,
        KeyConditionExpression: "companyId = :companyId",
        ExpressionAttributeValues: { ":companyId": companyId },
        ExclusiveStartKey,
      })
    );

    rows.push(...((res.Items ?? []) as RawUploadRow[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return rows.filter((row) => row.type === "inventory").map((row) => row.data);
}

async function loadRawWipBySku(companyId: string): Promise<Map<string, number>> {
  const rawInventoryRows = await readRawInventoryRows(companyId);
  const rawWipBySku = new Map<string, number>();

  for (const row of rawInventoryRows) {
    const sku = row.sku?.trim();
    if (!sku) continue;
    const qtyWip = Number(row.qty_wip ?? 0);
    if (!Number.isFinite(qtyWip)) continue;
    rawWipBySku.set(sku, qtyWip);
  }

  return rawWipBySku;
}

async function loadSeedWipBySku(): Promise<Map<string, number>> {
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

async function loadInventoryRows(companyId: string) {
  const rawWipBySku = await loadRawWipBySku(companyId).catch(() => new Map<string, number>());
  const seedWipBySku = await loadSeedWipBySku().catch(() => new Map<string, number>());

  try {
    const rows = await db.select().from(inventory).where(eq(inventory.companyId, companyId));
    return rows.map((row) => {
      const rawWip = rawWipBySku.get(row.sku);
      const seedWip = seedWipBySku.get(row.sku);
      return {
        ...row,
        qtyWip: row.qtyWip && row.qtyWip > 0 ? row.qtyWip : rawWip ?? seedWip ?? row.qtyWip ?? 0,
      };
    });
  } catch (error) {
    if (!isMissingWipColumnError(error)) throw error;

    const legacyRows = await db
      .select({
        id: inventory.id,
        companyId: inventory.companyId,
        sku: inventory.sku,
        qtyOnHand: inventory.qtyOnHand,
        unitCost: inventory.unitCost,
        vendorName: inventory.vendorName,
        vendorCountry: inventory.vendorCountry,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .where(eq(inventory.companyId, companyId));

    return legacyRows.map((row) => ({ ...row, qtyWip: rawWipBySku.get(row.sku) ?? seedWipBySku.get(row.sku) ?? 0 }));
  }
}

// Loads everything an agent needs about one company from Aurora.
// This is the fix for the core bug: agents used to prompt Claude with no
// data, so it invented numbers. Now we pass the real rows.
export async function getCompanyData(companyId: string) {
  const [sales, inv, invs, custs, pays, vens] = await Promise.all([
    db.select().from(skuSalesHistory).where(eq(skuSalesHistory.companyId, companyId)),
    loadInventoryRows(companyId),
    db.select().from(invoices).where(eq(invoices.companyId, companyId)),
    db.select().from(customers).where(eq(customers.companyId, companyId)),
    db.select().from(payables).where(eq(payables.companyId, companyId)),
    db.select().from(vendors).where(eq(vendors.companyId, companyId)),
  ]);
  return { sales, inventory: inv, invoices: invs, customers: custs, payables: pays, vendors: vens };
}

// Days of Inventory Outstanding = current inventory value / average daily
// cost of goods sold, derived purely from Aurora data (no LLM — it's a
// deterministic financial formula, not something to "forecast").
export async function getInventoryMetrics(companyId: string) {
  const { sales, inventory: inv } = await getCompanyData(companyId);

  const unitCostBySku = new Map(inv.map((row) => [row.sku, Number(row.unitCost ?? 0)]));

  const totalInventoryValue = inv.reduce(
    (sum, row) => sum + row.qtyOnHand * Number(row.unitCost ?? 0),
    0
  );
  const totalWipUnits = inv.reduce((sum, row) => sum + (row.qtyWip ?? 0), 0);
  const totalWipValue = inv.reduce((sum, row) => sum + (row.qtyWip ?? 0) * Number(row.unitCost ?? 0), 0);
  const totalOnHandUnits = inv.reduce((sum, row) => sum + row.qtyOnHand, 0);
  const totalSupplyUnits = totalOnHandUnits + totalWipUnits;
  const totalSupplyValue = totalInventoryValue + totalWipValue;
  const wipShareOfSupplyValue = totalSupplyValue > 0 ? totalWipValue / totalSupplyValue : 0;

  const totalCogs = sales.reduce(
    (sum, row) => sum + row.soldQty * (unitCostBySku.get(row.sku) ?? 0),
    0
  );

  const soldDates = sales.map((row) => new Date(row.soldAt).getTime());
  const spanDays = soldDates.length
    ? Math.max(1, Math.round((Math.max(...soldDates) - Math.min(...soldDates)) / 86_400_000) + 1)
    : 0;

  const avgDailyCogs = spanDays > 0 ? totalCogs / spanDays : 0;
  const daysOfInventoryOutstanding = avgDailyCogs > 0 ? totalInventoryValue / avgDailyCogs : null;

  return {
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
}

// Most-negative gap across the stored forecast — used to size financing.
export async function getWorstGap(companyId: string): Promise<number> {
  const rows = await db
    .select()
    .from(cashFlowForecast)
    .where(eq(cashFlowForecast.companyId, companyId));

  if (rows.length === 0) return 0;
  const worst = rows.reduce((min, r) => {
    const g = Number(r.gap ?? 0);
    return g < min ? g : min;
  }, 0);
  // Return a positive shortfall amount (0 if never goes negative).
  return worst < 0 ? Math.abs(worst) : 0;
}
