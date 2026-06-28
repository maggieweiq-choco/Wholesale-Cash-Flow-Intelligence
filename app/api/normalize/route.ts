import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/etl";
import { requireCompanyId } from "@/lib/dal";

// Reads the company's raw rows from DynamoDB and writes cleaned, typed
// rows into Aurora. Call this after /api/upload, before the agents run.
export async function POST() {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const counts = await normalizeCompany(companyId);
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Normalize failed";
    console.error("Normalize failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
