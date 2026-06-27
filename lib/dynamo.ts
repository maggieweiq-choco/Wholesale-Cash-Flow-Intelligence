import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsCredentials, awsRegion } from "@/lib/aws-credentials";

const client = new DynamoDBClient({ region: awsRegion, credentials: awsCredentials });

export const dynamo = DynamoDBDocumentClient.from(client);

export const RAW_TABLE_NAME = process.env.DYNAMO_TABLE_NAME ?? "cashflow-raw";

// DynamoDB's BatchWriteItem caps out at 25 items per call. Firing one
// dynamo.send() promise per row (as a large CSV easily has hundreds of rows)
// blows past Node's async-hook tracking limits in dev and is wasteful in
// production, so chunk + batch instead.
export async function batchPutItems(items: Record<string, unknown>[]): Promise<void> {
  const CHUNK_SIZE = 25;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    let requestItems = chunk.map((Item) => ({ PutRequest: { Item } }));

    while (requestItems.length > 0) {
      const res = await dynamo.send(
        new BatchWriteCommand({ RequestItems: { [RAW_TABLE_NAME]: requestItems } })
      );
      requestItems = (res.UnprocessedItems?.[RAW_TABLE_NAME] as typeof requestItems) ?? [];
    }
  }
}
