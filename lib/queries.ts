import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import {
  skuSalesHistory,
  inventory,
  invoices,
  customers,
  payables,
  vendors,
  cashFlowForecast,
} from "@/db/schema";

// Loads everything an agent needs about one company from Aurora.
// This is the fix for the core bug: agents used to prompt Claude with no
// data, so it invented numbers. Now we pass the real rows.
export async function getCompanyData(companyId: string) {
  const [sales, inv, invs, custs, pays, vens] = await Promise.all([
    db.select().from(skuSalesHistory).where(eq(skuSalesHistory.companyId, companyId)),
    db.select().from(inventory).where(eq(inventory.companyId, companyId)),
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

  return { totalInventoryValue, avgDailyCogs, daysOfInventoryOutstanding };
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
