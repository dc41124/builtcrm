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
  return NextResponse.next({ request: { headers: requestHeaders } });
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
