import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import {
  getGlobalSearchResults,
  type SearchPortal,
} from "@/domain/loaders/search";

// GET /api/search?q=...&portalType=...
//
// Portal-aware global search for the command palette. Echoes the
// query in the response (`q`) so the client can discard stale
// responses when input has moved on. AbortController-based race
// safety on the client side is the primary defense; the echo is a
// belt-and-suspenders check.

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const portalParam = url.searchParams.get("portalType");
  const portalType: SearchPortal | null =
    portalParam === "contractor" ||
    portalParam === "subcontractor" ||
    portalParam === "commercial" ||
    portalParam === "residential"
      ? portalParam
      : null;
  if (!portalType) {
    return NextResponse.json(
      { error: "invalid_portal" },
      { status: 400 },
    );
  }

  const results = await getGlobalSearchResults({
    appUserId,
    portalType,
    query: q,
  });

  return NextResponse.json({ q, results });
}
