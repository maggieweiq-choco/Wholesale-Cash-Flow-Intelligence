import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import * as schema from "@/db/schema";
import { awsCredentials, awsRegion } from "@/lib/aws-credentials";

const client = new RDSDataClient({ region: awsRegion, credentials: awsCredentials });

export const db = drizzle(client, {
  database: process.env.AURORA_DATABASE ?? "cashflow",
  secretArn: process.env.AURORA_SECRET_ARN ?? "",
  resourceArn: process.env.AURORA_CLUSTER_ARN ?? "",
  schema,
});
