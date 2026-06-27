import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { batchPutItems } from "@/lib/dynamo";
import { parseCsv, type UploadType } from "@/lib/csv-parser";
import { normalizeCompany } from "@/lib/etl";
import { requireCompanyId } from "@/lib/dal";

const SEED_FILES: { type: UploadType; file: string }[] = [
  { type: "sales", file: "sales.csv" },
  { type: "inventory", file: "inventory.csv" },
  { type: "invoice", file: "invoices.csv" },
];

// Loads the bundled seed/*.csv files into the current user's company
// workspace so first-time users can see the product working before
// uploading their own data.
export async function POST() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const uploadedAt = new Date().toISOString();
  let totalRows = 0;

  for (const { type, file } of SEED_FILES) {
    const contents = await readFile(join(process.cwd(), "seed", file), "utf-8");
    const rows = parseCsv(contents);
    const uploadId = crypto.randomUUID();

    await batchPutItems(
      rows.map((data, rowIndex) => ({
        companyId,
        rowId: `${uploadId}#${rowIndex}`,
        type,
        data,
        uploadedAt,
      }))
    );
    totalRows += rows.length;
  }

  const counts = await normalizeCompany(companyId);

  return NextResponse.json({ companyId, rowsUploaded: totalRows, counts });
}
