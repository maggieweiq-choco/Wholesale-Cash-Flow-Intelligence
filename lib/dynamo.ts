import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export const dynamo = DynamoDBDocumentClient.from(client);

export const RAW_TABLE_NAME = process.env.DYNAMO_TABLE_NAME ?? "cashflow-raw";
