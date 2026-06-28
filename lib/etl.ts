import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { eq } from "drizzle-orm";
import { dynamo, RAW_TABLE_NAME } from "@/lib/dynamo";
import { db } from "@/lib/aurora";
import {
  skuSalesHistory,
  inventory,
  invoices,
  customers,
  payables,
  vendors,
} from "@/db/schema";
import type { RawUploadRow } from "@/db/dynamo";

// Expected CSV columns (the seed files in /seed match these):
//   sales.csv:     sku, sold_qty, revenue, sold_at(YYYY-MM-DD), customer_id(optional)
//   inventory.csv: sku, qty_on_hand, unit_cost, vendor_name(optional), vendor_country(optional)
//   invoices.csv:  customer_id, customer_name, amount, issued_at, due_at, paid_at(optional)
//   payables.csv:  vendor_id, vendor_name, amount, issued_at, due_at, paid_at(optional)

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

// Aurora Data API caps request/response payloads at 1MB, so a single
// db.insert(...).values(allRows) call fails once a CSV gets large. Insert in
// fixed-size chunks instead — keeps every call well under that limit
// regardless of how many rows a company uploads.
async function insertInChunks<T>(
  rows: T[],
  insertFn: (chunk: T[]) => Promise<unknown>,
  chunkSize = 200
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await insertFn(rows.slice(i, i + chunkSize));
  }
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
  const payableRows = raw.filter((r) => r.type === "payable").map((r) => r.data);

  // Clear prior normalized data for this company.
  await Promise.all([
    db.delete(skuSalesHistory).where(eq(skuSalesHistory.companyId, companyId)),
    db.delete(inventory).where(eq(inventory.companyId, companyId)),
    db.delete(invoices).where(eq(invoices.companyId, companyId)),
    db.delete(customers).where(eq(customers.companyId, companyId)),
    db.delete(payables).where(eq(payables.companyId, companyId)),
    db.delete(vendors).where(eq(vendors.companyId, companyId)),
  ]);

  // --- sales ---
  if (salesRows.length) {
    const rows = salesRows.map((d) => ({
      companyId,
      sku: d.sku,
      customerId: d.customer_id && d.customer_id.trim() !== "" ? d.customer_id : null,
      soldQty: Number(d.sold_qty ?? 0),
      revenue: String(d.revenue ?? "0"),
      soldAt: d.sold_at,
    }));
    await insertInChunks(rows, (chunk) => db.insert(skuSalesHistory).values(chunk));
  }

  // --- inventory ---
  if (inventoryRows.length) {
    const rows = inventoryRows.map((d) => ({
      companyId,
      sku: d.sku,
      qtyOnHand: Number(d.qty_on_hand ?? 0),
      unitCost: String(d.unit_cost ?? "0"),
      vendorName: d.vendor_name && d.vendor_name.trim() !== "" ? d.vendor_name : null,
      vendorCountry: d.vendor_country && d.vendor_country.trim() !== "" ? d.vendor_country : null,
    }));
    await insertInChunks(rows, (chunk) => db.insert(inventory).values(chunk));
  }

  // --- invoices + derived customers ---
  if (invoiceRows.length) {
    const rows = invoiceRows.map((d) => ({
      companyId,
      customerId: d.customer_id,
      amount: String(d.amount ?? "0"),
      issuedAt: d.issued_at,
      dueAt: d.due_at,
      paidAt: d.paid_at && d.paid_at.trim() !== "" ? d.paid_at : null,
      status: d.paid_at && d.paid_at.trim() !== "" ? "paid" : "unpaid",
    }));
    await insertInChunks(rows, (chunk) => db.insert(invoices).values(chunk));

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
      await insertInChunks(customerRows, (chunk) => db.insert(customers).values(chunk));
    }
  }

  // --- payables + derived vendors ---
  if (payableRows.length) {
    const rows = payableRows.map((d) => ({
      companyId,
      vendorId: d.vendor_id,
      amount: String(d.amount ?? "0"),
      issuedAt: d.issued_at,
      dueAt: d.due_at,
      paidAt: d.paid_at && d.paid_at.trim() !== "" ? d.paid_at : null,
      status: d.paid_at && d.paid_at.trim() !== "" ? "paid" : "unpaid",
    }));
    await insertInChunks(rows, (chunk) => db.insert(payables).values(chunk));

    const vendorRows = [...new Map(payableRows.map((d) => [d.vendor_id, d.vendor_name ?? d.vendor_id])).entries()].map(
      ([id, name]) => ({ id, companyId, name })
    );
    if (vendorRows.length) {
      await insertInChunks(vendorRows, (chunk) => db.insert(vendors).values(chunk));
    }
  }

  return {
    sales: salesRows.length,
    inventory: inventoryRows.length,
    invoices: invoiceRows.length,
    customers: new Set(invoiceRows.map((d) => d.customer_id)).size,
    payables: payableRows.length,
    vendors: new Set(payableRows.map((d) => d.vendor_id)).size,
  };
}
