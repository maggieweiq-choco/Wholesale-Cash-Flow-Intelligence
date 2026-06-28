import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { eq, sql } from "drizzle-orm";
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
//   inventory.csv: sku, qty_on_hand, qty_wip(optional), unit_cost, vendor_name(optional), vendor_country(optional),
//                  vendor_lead_time_days(optional), return_rate_pct(optional), obsolete_risk(optional: low/medium/high)
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

function customAttributes(
  row: Record<string, string>,
  standardColumns: readonly string[]
): Record<string, string> {
  const standard = new Set(standardColumns);
  return Object.fromEntries(
    Object.entries(row).filter(([key, value]) => !standard.has(key) && value != null && String(value).trim() !== "")
  );
}

function isMissingCustomAttributesColumnError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error);

  return /custom_attributes|column .* does not exist/i.test(message);
}

async function insertWithCustomAttributesFallback<T extends { customAttributes: Record<string, string> }>(
  rows: T[],
  insertFn: (chunk: T[]) => Promise<unknown>,
  legacyInsertFn: (chunk: Omit<T, "customAttributes">[]) => Promise<unknown>
): Promise<void> {
  try {
    await insertInChunks(rows, insertFn);
  } catch (error) {
    if (!isMissingCustomAttributesColumnError(error)) throw error;
    const legacyRows = rows.map((row) => {
      const { customAttributes: ignoredCustomAttributes, ...legacyRow } = row;
      void ignoredCustomAttributes;
      return legacyRow;
    });
    await insertInChunks(legacyRows, legacyInsertFn);
  }
}

const SALES_STANDARD_COLUMNS = ["sku", "sold_qty", "revenue", "sold_at", "customer_id"] as const;
const INVENTORY_STANDARD_COLUMNS = ["sku", "qty_on_hand", "qty_wip", "unit_cost", "vendor_name", "vendor_country"] as const;
const INVOICE_STANDARD_COLUMNS = ["customer_id", "customer_name", "amount", "issued_at", "due_at", "paid_at"] as const;
const PAYABLE_STANDARD_COLUMNS = ["vendor_id", "vendor_name", "amount", "issued_at", "due_at", "paid_at"] as const;

async function ensureFlexibleColumns(): Promise<void> {
  const statements = [
    `ALTER TABLE "sku_sales_history" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL`,
    `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "qty_wip" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "vendor_lead_time_days" integer DEFAULT 14 NOT NULL`,
    `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "return_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL`,
    `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "obsolete_risk" text DEFAULT 'low' NOT NULL`,
    `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL`,
    `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL`,
    `ALTER TABLE "payables" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

// Raw DynamoDB rows are never deleted, so re-clicking "Load Sample Data" (or
// re-uploading the same file) keeps adding rows that normalizeCompany would
// otherwise re-derive into duplicate Aurora records every time. Collapse
// rows that share the same content key down to the most recently uploaded
// one before inserting.
function dedupeRawRows(
  rows: RawUploadRow[],
  keyFn: (data: Record<string, string>) => string
): Record<string, string>[] {
  const latest = new Map<string, RawUploadRow>();
  for (const r of rows) {
    const key = keyFn(r.data);
    const prev = latest.get(key);
    if (!prev || r.uploadedAt > prev.uploadedAt) latest.set(key, r);
  }
  return [...latest.values()].map((r) => r.data);
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
  await ensureFlexibleColumns();
  const columnsByType = raw.reduce<Record<string, string[]>>((acc, row) => {
    const existing = new Set(acc[row.type] ?? []);
    for (const column of Object.keys(row.data)) existing.add(column);
    acc[row.type] = [...existing].sort();
    return acc;
  }, {});
  const customColumnsByType: Record<string, string[]> = {
    sales: (columnsByType.sales ?? []).filter((column) => !SALES_STANDARD_COLUMNS.includes(column as (typeof SALES_STANDARD_COLUMNS)[number])),
    inventory: (columnsByType.inventory ?? []).filter(
      (column) => !INVENTORY_STANDARD_COLUMNS.includes(column as (typeof INVENTORY_STANDARD_COLUMNS)[number])
    ),
    invoice: (columnsByType.invoice ?? []).filter((column) => !INVOICE_STANDARD_COLUMNS.includes(column as (typeof INVOICE_STANDARD_COLUMNS)[number])),
    payable: (columnsByType.payable ?? []).filter((column) => !PAYABLE_STANDARD_COLUMNS.includes(column as (typeof PAYABLE_STANDARD_COLUMNS)[number])),
  };

  // Sales is a genuine transaction log — every row is a separate sale, so it
  // is never deduped.
  const salesRows = raw.filter((r) => r.type === "sales").map((r) => r.data);

  // Inventory is a current-state snapshot: dedupe to one row per SKU (the
  // most recently uploaded).
  const inventoryRows = dedupeRawRows(
    raw.filter((r) => r.type === "inventory"),
    (d) => d.sku
  );

  // Invoices/payables don't carry a natural ID in the CSV, and re-clicking
  // "Load Sample Data" (or re-uploading the same file) would otherwise
  // re-derive the exact same invoice/bill as a brand-new duplicate every
  // time. Two records are treated as the same document if they share
  // customer/vendor + amount + issued/due dates — a real distinct invoice
  // with all four identical is vanishingly unlikely.
  const invoiceRows = dedupeRawRows(
    raw.filter((r) => r.type === "invoice"),
    (d) => `${d.customer_id}|${d.amount}|${d.issued_at}|${d.due_at}`
  );
  const payableRows = dedupeRawRows(
    raw.filter((r) => r.type === "payable"),
    (d) => `${d.vendor_id}|${d.amount}|${d.issued_at}|${d.due_at}`
  );

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
      customAttributes: customAttributes(d, SALES_STANDARD_COLUMNS),
    }));
    await insertWithCustomAttributesFallback(
      rows,
      (chunk) => db.insert(skuSalesHistory).values(chunk),
      (chunk) => db.insert(skuSalesHistory).values(chunk)
    );
  }

  // --- inventory ---
  if (inventoryRows.length) {
    const rows = inventoryRows.map((d) => ({
      companyId,
      sku: d.sku,
      qtyOnHand: Number(d.qty_on_hand ?? 0),
      qtyWip: Number(d.qty_wip ?? 0),
      unitCost: String(d.unit_cost ?? "0"),
      vendorName: d.vendor_name && d.vendor_name.trim() !== "" ? d.vendor_name : null,
      vendorCountry: d.vendor_country && d.vendor_country.trim() !== "" ? d.vendor_country : null,
      vendorLeadTimeDays: Number(d.vendor_lead_time_days ?? 14),
      returnRatePct: String(d.return_rate_pct ?? "0"),
      obsoleteRisk: d.obsolete_risk && d.obsolete_risk.trim() !== "" ? d.obsolete_risk : "low",
      customAttributes: customAttributes(d, INVENTORY_STANDARD_COLUMNS),
    }));
    await insertWithCustomAttributesFallback(
      rows,
      (chunk) => db.insert(inventory).values(chunk),
      (chunk) => db.insert(inventory).values(chunk)
    );
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
      customAttributes: customAttributes(d, INVOICE_STANDARD_COLUMNS),
    }));
    await insertWithCustomAttributesFallback(
      rows,
      (chunk) => db.insert(invoices).values(chunk),
      (chunk) => db.insert(invoices).values(chunk)
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
      customAttributes: customAttributes(d, PAYABLE_STANDARD_COLUMNS),
    }));
    await insertWithCustomAttributesFallback(
      rows,
      (chunk) => db.insert(payables).values(chunk),
      (chunk) => db.insert(payables).values(chunk)
    );

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
    columnsByType,
    customColumnsByType,
  };
}
