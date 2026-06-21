import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import {
  skuSalesHistory,
  inventory,
  invoices,
  customers,
  cashFlowForecast,
} from "@/db/schema";

// Loads everything an agent needs about one company from Aurora.
// This is the fix for the core bug: agents used to prompt Claude with no
// data, so it invented numbers. Now we pass the real rows.
export async function getCompanyData(companyId: string) {
  const [sales, inv, invs, custs] = await Promise.all([
    db.select().from(skuSalesHistory).where(eq(skuSalesHistory.companyId, companyId)),
    db.select().from(inventory).where(eq(inventory.companyId, companyId)),
    db.select().from(invoices).where(eq(invoices.companyId, companyId)),
    db.select().from(customers).where(eq(customers.companyId, companyId)),
  ]);
  return { sales, inventory: inv, invoices: invs, customers: custs };
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
