import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import * as schema from "@/db/schema";

const client = new RDSDataClient({ region: process.env.AWS_REGION });

export const db = drizzle(client, {
  database: process.env.AURORA_DATABASE ?? "cashflow",
  secretArn: process.env.AURORA_SECRET_ARN ?? "",
  resourceArn: process.env.AURORA_CLUSTER_ARN ?? "",
  schema,
});
