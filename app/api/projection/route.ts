import { NextRequest, NextResponse } from "next/server";
import { computeProjection } from "@/lib/projection";
import { requireCompanyId } from "@/lib/dal";

// Deterministic projection (no Claude call) — safe to hit on every page load.
export async function GET(request: NextRequest) {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("openingCash");
  const parsed = raw != null ? Number(raw) : 50_000;
  const openingCash = Number.isFinite(parsed) ? parsed : 50_000;

  const projection = await computeProjection(companyId, openingCash);
  return NextResponse.json(projection);
}