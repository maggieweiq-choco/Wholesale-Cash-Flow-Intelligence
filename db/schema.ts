import { pgTable, serial, text, integer, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const skuSalesHistory = pgTable("sku_sales_history", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  sku: text("sku").notNull(),
  soldQty: integer("sold_qty").notNull(),
  revenue: numeric("revenue", { precision: 12, scale: 2 }),
  soldAt: date("sold_at").notNull(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  sku: text("sku").notNull(),
  qtyOnHand: integer("qty_on_hand").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  customerId: text("customer_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  issuedAt: date("issued_at").notNull(),
  dueAt: date("due_at").notNull(),
  paidAt: date("paid_at"),
  status: text("status").default("unpaid"), // unpaid / partial / paid
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  avgDaysLate: numeric("avg_days_late", { precision: 5, scale: 1 }).default("0"),
  paymentScore: numeric("payment_score", { precision: 3, scale: 1 }).default("5"), // 1-10
});

export const cashFlowForecast = pgTable("cash_flow_forecast", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  forecastDt: date("forecast_dt").notNull(),
  cashIn: numeric("cash_in", { precision: 12, scale: 2 }),
  cashOut: numeric("cash_out", { precision: 12, scale: 2 }),
  balance: numeric("balance", { precision: 12, scale: 2 }),
  gap: numeric("gap", { precision: 12, scale: 2 }), // negative = danger
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const loanScenarios = pgTable("loan_scenarios", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  gapAmount: numeric("gap_amount", { precision: 12, scale: 2 }),
  optionType: text("option_type"), // bank_loan / liquidate / ar_finance
  amount: numeric("amount", { precision: 12, scale: 2 }),
  durationDays: integer("duration_days"),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  recommended: boolean("recommended").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
