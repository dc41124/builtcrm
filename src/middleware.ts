import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(req: NextRequest) {
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // Same-origin app — no CORS allowlist exists. Setting Vary: Origin
  // signals correct caching behaviour to upstream caches and prevents
  // a same-origin response from being served to a future cross-origin
  // request via shared cache.
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = {
  matcher: [
    "/contractor/:path*",
    "/subcontractor/:path*",
    "/commercial/:path*",
    "/residential/:path*",
    "/select-portal",
    "/no-portal",
  ],
};
