import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/signup"];
const secretKey = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const encodedKey = new TextEncoder().encode(secretKey);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get("session")?.value;
  if (!cookie) return false;
  try {
    await jwtVerify(cookie, encodedKey, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const authed = await hasValidSession(request);

  if (!isPublic && !authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isPublic && authed) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
