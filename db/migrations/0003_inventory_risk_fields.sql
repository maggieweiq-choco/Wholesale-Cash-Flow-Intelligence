ALTER TABLE "inventory" ADD COLUMN "vendor_lead_time_days" integer DEFAULT 14 NOT NULL;
ALTER TABLE "inventory" ADD COLUMN "return_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "inventory" ADD COLUMN "obsolete_risk" text DEFAULT 'low' NOT NULL;
