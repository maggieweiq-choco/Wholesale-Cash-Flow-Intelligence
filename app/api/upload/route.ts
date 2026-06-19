import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, RAW_TABLE_NAME } from "@/lib/dynamo";
import { parseCsv, type UploadType } from "@/lib/csv-parser";

// Parses an uploaded CSV (sales / inventory / invoice) and writes each row
// to DynamoDB as-is. Cleaning/normalization happens later in /api/forecast.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as UploadType | null;
  const companyId = formData.get("companyId") as string | null;

  if (!file || !type || !companyId) {
    return NextResponse.json({ error: "file, type, and companyId are required" }, { status: 400 });
  }

  const rows = parseCsv(await file.text());
  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  await Promise.all(
    rows.map((data, rowIndex) =>
      dynamo.send(
        new PutCommand({
          TableName: RAW_TABLE_NAME,
          Item: { companyId, rowId: `${uploadId}#${rowIndex}`, type, data, uploadedAt },
        })
      )
    )
  );

  return NextResponse.json({ uploadId, rowCount: rows.length });
}
