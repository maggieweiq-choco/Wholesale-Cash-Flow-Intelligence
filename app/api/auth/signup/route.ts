import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/aurora";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";

function slugify(username: string): string {
  const base = username.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

// Password auth is disabled for now — username only, no password check.
export async function POST(request: NextRequest) {
  const { username } = await request.json();
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing.length > 0) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const companyId = slugify(username);

  await db.insert(users).values({ id, username, companyId });
  await createSession({ userId: id, companyId });

  return NextResponse.json({ username, companyId });
}
