import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";

// Password auth is disabled for now — username only, no password check.
export async function POST(request: NextRequest) {
  const { username } = await request.json();
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.username, username));
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "No account with that username" }, { status: 401 });
  }

  await createSession({ userId: user.id, companyId: user.companyId });
  return NextResponse.json({ username: user.username, companyId: user.companyId });
}
