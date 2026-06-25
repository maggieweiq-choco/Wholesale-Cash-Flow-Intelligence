import "server-only";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/aurora";
import { users } from "@/db/schema";

// Verifies the session cookie for a Route Handler and returns the
// authenticated user's companyId, or null if there is no valid session.
// Every data-bearing API route should call this instead of trusting a
// client-supplied companyId, so one user can never read/write another's data.
export async function requireCompanyId(): Promise<string | null> {
  const session = await getSession();
  return session?.companyId ?? null;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const rows = await db.select().from(users).where(eq(users.id, session.userId));
  return rows[0] ?? null;
}
