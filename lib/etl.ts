import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { eq } from "drizzle-orm";
import { dynamo, RAW_TABLE_NAME } from "@/lib/dynamo";
import { db } from "@/lib/aurora";
import {
  skuSalesHistory,
  inventory,
  invoices,
  customers,
} from "@/db/schema";
import type { RawUploadRow } from "@/db/dynamo";

// Expected CSV columns (the seed files in /seed match these):
//   sales.csv:     sku, sold_qty, revenue, sold_at(YYYY-MM-DD)
//   inventory.csv: sku, qty_on_hand, unit_cost
//   invoices.csv:  customer_id, customer_name, amount, issued_at, due_at, paid_at(optional)

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

// Read every raw row for a company from DynamoDB (handles pagination).
async function readRawRows(companyId: string): Promise<RawUploadRow[]> {
  const items: RawUploadRow[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: RAW_TABLE_NAME,
        KeyConditionExpression: "companyId = :c",
        ExpressionAttributeValues: { ":c": companyId },
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items ?? []) as RawUploadRow[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// DynamoDB raw rows -> cleaned, typed Aurora tables. Idempotent: wipes the
// company's existing rows first so re-running an upload doesn't duplicate.
export async function normalizeCompany(companyId: string) {
  const raw = await readRawRows(companyId);

  const salesRows = raw.filter((r) => r.type === "sales").map((r) => r.data);
  const inventoryRows = raw.filter((r) => r.type === "inventory").map((r) => r.data);
  const invoiceRows = raw.filter((r) => r.type === "invoice").map((r) => r.data);

  // Clear prior normalized data for this company.
  await Promise.all([
    db.delete(skuSalesHistory).where(eq(skuSalesHistory.companyId, companyId)),
    db.delete(inventory).where(eq(inventory.companyId, companyId)),
    db.delete(invoices).where(eq(invoices.companyId, companyId)),
    db.delete(customers).where(eq(customers.companyId, companyId)),
  ]);

  // --- sales ---
  if (salesRows.length) {
    await db.insert(skuSalesHistory).values(
      salesRows.map((d) => ({
        companyId,
        sku: d.sku,
        soldQty: Number(d.sold_qty ?? 0),
        revenue: String(d.revenue ?? "0"),
        soldAt: d.sold_at,
      }))
    );
  }

  // --- inventory ---
  if (inventoryRows.length) {
    await db.insert(inventory).values(
      inventoryRows.map((d) => ({
        companyId,
        sku: d.sku,
        qtyOnHand: Number(d.qty_on_hand ?? 0),
        unitCost: String(d.unit_cost ?? "0"),
      }))
    );
  }

  // --- invoices + derived customers ---
  if (invoiceRows.length) {
    await db.insert(invoices).values(
      invoiceRows.map((d) => ({
        companyId,
        customerId: d.customer_id,
        amount: String(d.amount ?? "0"),
        issuedAt: d.issued_at,
        dueAt: d.due_at,
        paidAt: d.paid_at && d.paid_at.trim() !== "" ? d.paid_at : null,
        status: d.paid_at && d.paid_at.trim() !== "" ? "paid" : "unpaid",
      }))
    );

    // Derive customer payment behaviour from paid invoices.
    const byCustomer = new Map<string, { name: string; lateDays: number[] }>();
    for (const d of invoiceRows) {
      const entry = byCustomer.get(d.customer_id) ?? { name: d.customer_name ?? d.customer_id, lateDays: [] };
      if (d.paid_at && d.paid_at.trim() !== "") {
        entry.lateDays.push(Math.max(0, daysBetween(d.due_at, d.paid_at)));
      }
      byCustomer.set(d.customer_id, entry);
    }

    const customerRows = [...byCustomer.entries()].map(([id, c]) => {
      const avgLate = c.lateDays.length
        ? c.lateDays.reduce((a, b) => a + b, 0) / c.lateDays.length
        : 0;
      // 0 days late -> score 10; ~45 days late -> score ~1.
      const score = Math.min(10, Math.max(1, 10 - avgLate / 5));
      return {
        id,
        companyId,
        name: c.name,
        avgDaysLate: avgLate.toFixed(1),
        paymentScore: score.toFixed(1),
      };
    });

    if (customerRows.length) {
      await db.insert(customers).values(customerRows);
    }
  }

  return {
    sales: salesRows.length,
    inventory: inventoryRows.length,
    invoices: invoiceRows.length,
    customers: new Set(invoiceRows.map((d) => d.customer_id)).size,
  };
}
