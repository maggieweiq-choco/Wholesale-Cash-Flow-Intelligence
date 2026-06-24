CREATE TABLE IF NOT EXISTS "cash_flow_forecast" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"forecast_dt" date NOT NULL,
	"cash_in" numeric(12, 2),
	"cash_out" numeric(12, 2),
	"balance" numeric(12, 2),
	"gap" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"avg_days_late" numeric(5, 1) DEFAULT '0',
	"payment_score" numeric(3, 1) DEFAULT '5'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"sku" text NOT NULL,
	"qty_on_hand" integer NOT NULL,
	"unit_cost" numeric(12, 2),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"issued_at" date NOT NULL,
	"due_at" date NOT NULL,
	"paid_at" date,
	"status" text DEFAULT 'unpaid'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loan_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"gap_amount" numeric(12, 2),
	"option_type" text,
	"amount" numeric(12, 2),
	"duration_days" integer,
	"estimated_cost" numeric(12, 2),
	"recommended" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sku_sales_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"sku" text NOT NULL,
	"sold_qty" integer NOT NULL,
	"revenue" numeric(12, 2),
	"sold_at" date NOT NULL
);
