import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { getGlobalSearchResults } from "@/domain/loaders/search";
import { withErrorHandler } from "@/lib/api/error-handler";

const QuerySchema = z.object({
  q: z.string().max(200).default(""),
  portalType: z.enum(["contractor", "subcontractor", "commercial", "residential"]),
});

// GET /api/search?q=...&portalType=...
//
// Portal-aware global search for the command palette. Echoes the
// query in the response (`q`) so the client can discard stale
// responses when input has moved on. AbortController-based race
// safety on the client side is the primary defense; the echo is a
// belt-and-suspenders check.

export async function GET(req: Request) {
  return withErrorHandler(
    async () => {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
      const appUserId = (
        session.session as unknown as { appUserId?: string | null }
      ).appUserId;
      if (!appUserId) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }

      const url = new URL(req.url);
      const parsed = QuerySchema.safeParse(
        Object.fromEntries(url.searchParams.entries()),
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_query", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const results = await getGlobalSearchResults({
        appUserId,
        portalType: parsed.data.portalType,
        query: parsed.data.q,
      });

      return NextResponse.json({ q: parsed.data.q, results });
    },
    { path: "/api/search", method: "GET" },
  );
}
