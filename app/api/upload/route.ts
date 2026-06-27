import { NextRequest, NextResponse } from "next/server";
import { batchPutItems } from "@/lib/dynamo";
import { parseCsv, type UploadType } from "@/lib/csv-parser";
import { requireCompanyId } from "@/lib/dal";

// Parses an uploaded CSV (sales / inventory / invoice) and writes each row
// to DynamoDB as-is. Cleaning/normalization happens later in /api/forecast.
export async function POST(request: NextRequest) {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as UploadType | null;

  if (!file || !type) {
    return NextResponse.json({ error: "file and type are required" }, { status: 400 });
  }

  const rows = parseCsv(await file.text());
  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  await batchPutItems(
    rows.map((data, rowIndex) => ({
      companyId,
      rowId: `${uploadId}#${rowIndex}`,
      type,
      data,
      uploadedAt,
    }))
  );

  return NextResponse.json({ uploadId, rowCount: rows.length });
}
