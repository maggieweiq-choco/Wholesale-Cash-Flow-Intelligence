import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  driver: "aws-data-api",
  dbCredentials: {
    database: process.env.AURORA_DATABASE ?? "cashflow",
    secretArn: process.env.AURORA_SECRET_ARN ?? "",
    resourceArn: process.env.AURORA_CLUSTER_ARN ?? "",
  },
});
