import { NextRequest, NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/etl";

// Reads the company's raw rows from DynamoDB and writes cleaned, typed
// rows into Aurora. Call this after /api/upload, before the agents run.
export async function POST(request: NextRequest) {
  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const counts = await normalizeCompany(companyId);
  return NextResponse.json({ ok: true, counts });
}
