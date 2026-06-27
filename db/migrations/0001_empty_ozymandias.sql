CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"company_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "vendor_name" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "vendor_country" text;