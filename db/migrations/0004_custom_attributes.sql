ALTER TABLE "sku_sales_history" ADD COLUMN "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "inventory" ADD COLUMN "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "invoices" ADD COLUMN "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "payables" ADD COLUMN "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
